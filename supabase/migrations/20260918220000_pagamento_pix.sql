-- Pagamento por Pix (tarefas 3.8, 3.9 e 3.14): a parte do BANCO, que não depende de qual gateway
-- será escolhido (Mercado Pago ou Pagar.me, tarefa 3.1). O gateway só cria a cobrança e avisa; quem decide
-- se um pedido está pago é o banco, com estas regras:
--
--   * Confirmar pagamento é IDEMPOTENTE: o gateway repete avisos (é normal); a segunda vez não muda nada.
--   * Só confirma se o valor pago for EXATAMENTE o total do pedido. Diferente = não confirma e vai para revisão.
--   * Pagamento que chega DEPOIS do pedido cancelado/expirado nunca entra na cozinha: fica registrado para
--     alguém devolver o dinheiro (estorno).
--   * Pedido que ninguém pagou expira sozinho (expirar_pedidos_pendentes) e sai da fila anti-spam.
--
-- Tudo abaixo só pode ser chamado pelo servidor (service_role): nunca pelo navegador.

alter table public.pedidos
  add column pix_copia_cola text,            -- código "copia e cola" do Pix (o QR é desenhado a partir dele)
  add column pagamento_expira_em timestamptz; -- até quando o Pix pode ser pago

-- Pagamentos que uma pessoa precisa olhar (estornar ou conferir). Nunca apagar: é trilha de auditoria.
create table public.pagamentos_para_revisar (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  pagamento_externo_id text not null,
  motivo text not null check (motivo in ('pago_apos_cancelamento', 'valor_divergente')),
  valor_recebido_centavos integer not null,
  resolvido boolean not null default false,
  observacao text,
  created_at timestamptz not null default now(),
  unique (pagamento_externo_id, motivo)
);
create index pagamentos_para_revisar_abertos_idx on public.pagamentos_para_revisar (created_at)
  where not resolvido;

alter table public.pagamentos_para_revisar enable row level security;
create policy pagamentos_para_revisar_admin_total on public.pagamentos_para_revisar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedido cancelado/expirado NUNCA entra na fila de impressão, mesmo que um Pix atrasado caia depois.
create or replace function public.enfileirar_impressao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pagamento_status = 'pago'
     and new.status <> 'cancelado'
     and (tg_op = 'INSERT' or old.pagamento_status is distinct from 'pago') then
    insert into public.impressoes (pedido_id) values (new.id) on conflict (pedido_id) do nothing;
  end if;
  return new;
end;
$$;

-- Guarda a cobrança criada no gateway. Chamar de novo com a MESMA cobrança é seguro (não muda nada).
-- Devolve: 'registrada' | 'ja_registrada' | 'outra_cobranca_existente' | 'pedido_nao_aguarda_pagamento' | 'pedido_inexistente'
create or replace function public.registrar_cobranca_pix(
  p_pedido_id uuid,
  p_externo_id text,
  p_copia_cola text,
  p_expira_em timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ped public.pedidos%rowtype;
begin
  select * into ped from public.pedidos where id = p_pedido_id for update;
  if not found then
    return 'pedido_inexistente';
  end if;
  if ped.status <> 'aguardando_pagamento' or ped.pagamento_status <> 'pendente' then
    return 'pedido_nao_aguarda_pagamento';
  end if;
  if ped.pagamento_externo_id is not null then
    return case when ped.pagamento_externo_id = p_externo_id then 'ja_registrada' else 'outra_cobranca_existente' end;
  end if;

  update public.pedidos
     set pagamento_metodo = 'pix',
         pagamento_externo_id = p_externo_id,
         pix_copia_cola = p_copia_cola,
         pagamento_expira_em = p_expira_em
   where id = p_pedido_id;
  return 'registrada';
end;
$$;

-- Confirma um pagamento avisado pelo gateway. IDEMPOTENTE e com trava de valor.
-- Devolve: 'confirmado' | 'ja_confirmado' | 'valor_divergente' | 'pago_apos_cancelamento' | 'desconhecido'
create or replace function public.confirmar_pagamento_pix(p_externo_id text, p_valor_centavos integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ped public.pedidos%rowtype;
begin
  -- `for update` faz dois avisos simultâneos do mesmo pagamento entrarem um de cada vez.
  select * into ped from public.pedidos where pagamento_externo_id = p_externo_id for update;
  if not found then
    return 'desconhecido';
  end if;

  if ped.pagamento_status = 'pago' then
    return 'ja_confirmado';
  end if;

  if p_valor_centavos is distinct from ped.total_centavos then
    insert into public.pagamentos_para_revisar (pedido_id, pagamento_externo_id, motivo, valor_recebido_centavos)
    values (ped.id, p_externo_id, 'valor_divergente', coalesce(p_valor_centavos, 0))
    on conflict (pagamento_externo_id, motivo) do nothing;
    return 'valor_divergente';
  end if;

  if ped.status = 'cancelado' then
    -- O dinheiro entrou, mas o pedido já tinha sido cancelado/expirado: registra e pede estorno.
    update public.pedidos set pagamento_status = 'pago', pago_em = now() where id = ped.id;
    insert into public.pagamentos_para_revisar (pedido_id, pagamento_externo_id, motivo, valor_recebido_centavos)
    values (ped.id, p_externo_id, 'pago_apos_cancelamento', p_valor_centavos)
    on conflict (pagamento_externo_id, motivo) do nothing;
    return 'pago_apos_cancelamento';
  end if;

  update public.pedidos
     set pagamento_status = 'pago',
         pago_em = now(),
         status = case when status = 'aguardando_pagamento' then 'novo' else status end
   where id = ped.id;
  return 'confirmado';
end;
$$;

-- Cancela pedidos que ninguém pagou a tempo. O prazo é o do Pix (pagamento_expira_em) mais 2 minutos de
-- folga (o gateway pode demorar a avisar); se o Pix ainda nem foi gerado, vale `p_minutos` desde o pedido.
-- Devolve quantos pedidos foram cancelados.
create or replace function public.expirar_pedidos_pendentes(p_minutos integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.pedidos
     set status = 'cancelado',
         pagamento_status = 'expirado',
         motivo_cancelamento = 'Pagamento não realizado a tempo'
   where status = 'aguardando_pagamento'
     and pagamento_status = 'pendente'
     and coalesce(pagamento_expira_em + interval '2 minutes', created_at + make_interval(mins => p_minutos)) < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Acompanhamento: agora também devolve o Pix (só enquanto dá para pagar) e o prazo. Muda o tipo de
-- retorno, então a função é recriada.
drop function if exists public.acompanhar_pedido(uuid);
create function public.acompanhar_pedido(p_token uuid)
returns table (
  numero bigint,
  tipo public.tipo_entrega,
  status public.status_pedido,
  pagamento_status public.status_pagamento,
  total_centavos integer,
  criado_em timestamptz,
  pix_copia_cola text,
  pagamento_expira_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.numero, p.tipo, p.status, p.pagamento_status, p.total_centavos, p.created_at,
         case when p.status = 'aguardando_pagamento' and p.pagamento_status = 'pendente'
              then p.pix_copia_cola end,
         p.pagamento_expira_em
  from public.pedidos p
  where p.token_acompanhamento = p_token;
$$;
revoke all on function public.acompanhar_pedido(uuid) from public;
grant execute on function public.acompanhar_pedido(uuid) to anon, authenticated;

-- Só o servidor mexe em pagamento.
revoke all on function public.registrar_cobranca_pix(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.confirmar_pagamento_pix(text, integer) from public, anon, authenticated;
revoke all on function public.expirar_pedidos_pendentes(integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_cobranca_pix(uuid, text, text, timestamptz) to service_role;
    grant execute on function public.confirmar_pagamento_pix(text, integer) to service_role;
    grant execute on function public.expirar_pedidos_pendentes(integer) to service_role;
  end if;
end
$$;
