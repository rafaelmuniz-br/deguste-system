-- Fila de impressão dos pedidos na cozinha (tarefas 4.9, 4.10; base da 4.7).
--
-- Regra de ouro: um pedido pago só é "impresso" quando o AGENTE da cozinha CONFIRMA. Se falhar, tenta de
-- novo com espera crescente; se travar no meio, a reserva expira e outro ciclo pega; se esgotar as
-- tentativas, vira `falhou` e aparece como problema para uma pessoa resolver (nada some em silêncio).
--
-- O agente (programa no PC da cozinha) NÃO usa a service role: entra com uma conta própria listada em
-- `agentes_impressao` e só consegue chamar as funções abaixo (não lê tabelas). Ver docs/impressao.md.

create table public.agentes_impressao (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table public.impressoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos (id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_impressao', 'impresso', 'falhou')),
  tentativas integer not null default 0,
  vezes_impresso integer not null default 0,
  proxima_tentativa_em timestamptz,          -- espera (backoff) depois de uma falha
  reserva_ate timestamptz,                   -- "em impressão" só vale até aqui; depois outro ciclo pega
  ultima_tentativa_em timestamptz,
  erro text,
  impresso_em timestamptz,
  created_at timestamptz not null default now()
);
create index impressoes_fila_idx on public.impressoes (status, created_at);

alter table public.agentes_impressao enable row level security;
alter table public.impressoes enable row level security;
revoke all on public.agentes_impressao from anon, authenticated;
revoke all on public.impressoes from anon;
create policy impressoes_admin_total on public.impressoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedido que passa a "pago" entra na fila automaticamente (uma vez só por pedido).
create or replace function public.enfileirar_impressao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pagamento_status = 'pago'
     and (tg_op = 'INSERT' or old.pagamento_status is distinct from 'pago') then
    insert into public.impressoes (pedido_id) values (new.id) on conflict (pedido_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger pedidos_enfileirar_impressao
  after insert or update of pagamento_status on public.pedidos
  for each row execute function public.enfileirar_impressao();

-- Quem pode operar a fila: o agente, um admin, ou o servidor (chamada sem usuário; anon/visitante nem
-- chega aqui, pois o execute é revogado abaixo).
create or replace function public.pode_operar_impressao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or exists (select 1 from public.agentes_impressao where user_id = auth.uid())
      or public.is_admin();
$$;

-- Próximo pedido a imprimir, já com tudo que o recibo precisa. Reserva por 90 s. Devolve null se a fila está vazia.
create or replace function public.proxima_impressao()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.impressoes%rowtype;
  v_max constant integer := 5;
begin
  if not public.pode_operar_impressao() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  loop
    select * into j
    from public.impressoes
    where (status = 'pendente' and coalesce(proxima_tentativa_em, now()) <= now())
       or (status = 'em_impressao' and reserva_ate < now())
    order by created_at
    limit 1
    for update skip locked;

    if not found then
      return null;
    end if;

    -- Reserva que expirou = o agente sumiu no meio; se já gastou as tentativas, vira problema visível.
    if j.tentativas >= v_max then
      update public.impressoes
        set status = 'falhou', erro = coalesce(erro, 'sem resposta do agente'), reserva_ate = null
        where id = j.id;
      continue;
    end if;

    update public.impressoes
      set status = 'em_impressao', tentativas = tentativas + 1, reserva_ate = now() + interval '90 seconds',
          ultima_tentativa_em = now()
      where id = j.id
      returning * into j;

    return (
      select jsonb_build_object(
        'impressao_id', j.id,
        'tentativa', j.tentativas,
        'reimpressao', j.vezes_impresso > 0,
        'pedido', jsonb_build_object(
          'numero', p.numero, 'criado_em', p.created_at, 'canal', p.canal, 'tipo', p.tipo,
          'cliente_nome', p.cliente_nome, 'cliente_telefone', p.cliente_telefone,
          'endereco_rua', p.endereco_rua, 'endereco_numero', p.endereco_numero,
          'endereco_bairro', p.endereco_bairro, 'endereco_complemento', p.endereco_complemento,
          'endereco_referencia', p.endereco_referencia,
          'observacoes', p.observacoes, 'pagamento_metodo', p.pagamento_metodo,
          'pagamento_status', p.pagamento_status,
          'subtotal_centavos', p.subtotal_centavos, 'taxa_entrega_centavos', p.taxa_entrega_centavos,
          'desconto_centavos', p.desconto_centavos, 'total_centavos', p.total_centavos
        ),
        'itens', coalesce((
          select jsonb_agg(jsonb_build_object(
            'nome', i.nome, 'quantidade', i.quantidade, 'observacoes', i.observacoes,
            'componentes', coalesce((
              select jsonb_agg(jsonb_build_object(
                'grupo', c.grupo_nome, 'opcao', c.opcao_nome, 'quantidade', c.quantidade
              ) order by c.grupo_nome, c.opcao_nome)
              from public.itens_pedido_componentes c where c.item_pedido_id = i.id
            ), '[]'::jsonb)
          ) order by i.nome)
          from public.itens_pedido i where i.pedido_id = p.id
        ), '[]'::jsonb)
      )
      from public.pedidos p where p.id = j.pedido_id
    );
  end loop;
end;
$$;

create or replace function public.confirmar_impressao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_operar_impressao() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update public.impressoes
    set status = 'impresso', impresso_em = now(), vezes_impresso = vezes_impresso + 1,
        erro = null, reserva_ate = null, proxima_tentativa_em = null
    where id = p_id and status = 'em_impressao';
  if not found then
    raise exception 'impressao_nao_reservada' using errcode = 'P0001';
  end if;
end;
$$;

-- Falhou: tenta de novo com espera crescente (10 s, 20 s, 40 s, ... até 5 min); na 5ª falha vira `falhou`.
create or replace function public.registrar_falha_impressao(p_id uuid, p_erro text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.impressoes%rowtype;
begin
  if not public.pode_operar_impressao() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into j from public.impressoes where id = p_id and status = 'em_impressao' for update;
  if not found then
    raise exception 'impressao_nao_reservada' using errcode = 'P0001';
  end if;

  if j.tentativas >= 5 then
    update public.impressoes set status = 'falhou', erro = left(p_erro, 500), reserva_ate = null where id = p_id;
    return 'falhou';
  end if;
  update public.impressoes
    set status = 'pendente', erro = left(p_erro, 500), reserva_ate = null,
        proxima_tentativa_em = now() + make_interval(secs => least(300, 10 * power(2, j.tentativas - 1)))
    where id = p_id;
  return 'pendente';
end;
$$;

-- Reimpressão manual (4.10): volta o pedido para a fila, mesmo que já tenha sido impresso ou tenha falhado.
create or replace function public.reimprimir_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or auth.uid() is null) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  insert into public.impressoes (pedido_id) values (p_pedido_id)
  on conflict (pedido_id) do update
    set status = 'pendente', tentativas = 0, erro = null, reserva_ate = null, proxima_tentativa_em = null;
end;
$$;

-- Problemas que uma pessoa precisa ver: falhou de vez, ou está na fila há mais de 2 minutos sem imprimir.
create or replace view public.impressoes_com_problema
with (security_invoker = true) as
  select i.id, i.pedido_id, p.numero, i.status, i.tentativas, i.erro, i.created_at
  from public.impressoes i
  join public.pedidos p on p.id = i.pedido_id
  where i.status = 'falhou'
     or (i.status in ('pendente', 'em_impressao') and i.created_at < now() - interval '2 minutes');

-- Permissões: nada disso é público.
revoke all on public.impressoes_com_problema from anon;
revoke all on function public.enfileirar_impressao() from public, anon, authenticated;
revoke all on function public.pode_operar_impressao() from public, anon;
revoke all on function public.proxima_impressao() from public, anon;
revoke all on function public.confirmar_impressao(uuid) from public, anon;
revoke all on function public.registrar_falha_impressao(uuid, text) from public, anon;
revoke all on function public.reimprimir_pedido(uuid) from public, anon;
grant execute on function public.pode_operar_impressao() to authenticated;
grant execute on function public.proxima_impressao() to authenticated;
grant execute on function public.confirmar_impressao(uuid) to authenticated;
grant execute on function public.registrar_falha_impressao(uuid, text) to authenticated;
grant execute on function public.reimprimir_pedido(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.proxima_impressao() to service_role;
    grant execute on function public.confirmar_impressao(uuid) to service_role;
    grant execute on function public.registrar_falha_impressao(uuid, text) to service_role;
    grant execute on function public.reimprimir_pedido(uuid) to service_role;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.impressoes;
  end if;
end
$$;
