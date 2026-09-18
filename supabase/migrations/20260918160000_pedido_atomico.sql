-- Criação ATÔMICA do pedido, token de acompanhamento e limite anti-spam (tarefas 3.7, 3.10 e 3.11).
--
-- Quem chama `criar_pedido` é a função do servidor (Netlify) com a service role, DEPOIS de recalcular
-- preços e frete. O navegador nunca chama esta função (execute revogado). Como tudo roda numa única
-- função, ou o pedido inteiro é gravado (cliente + pedido + itens + componentes) ou nada é.

-- Token que o cliente usa para acompanhar o pedido, sem login. UUID v4 = 122 bits, não dá para adivinhar.
alter table public.pedidos
  add column token_acompanhamento uuid not null default gen_random_uuid();
create unique index pedidos_token_uidx on public.pedidos (token_acompanhamento);

create or replace function public.criar_pedido(p jsonb)
returns table (o_id uuid, o_numero bigint, o_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido jsonb := p -> 'pedido';
  v_id uuid;
  v_telefone text;
  v_cliente_id uuid;
  v_pendentes integer;
  v_soma bigint;
begin
  if v_pedido is null
     or jsonb_typeof(p -> 'itens') is distinct from 'array'
     or jsonb_array_length(p -> 'itens') = 0 then
    raise exception 'pedido_invalido' using errcode = 'P0001';
  end if;

  v_id := (v_pedido ->> 'id')::uuid;
  v_telefone := v_pedido ->> 'cliente_telefone';

  -- Anti-spam: no máximo 3 pedidos aguardando pagamento por telefone nos últimos 15 minutos.
  select count(*) into v_pendentes
  from public.pedidos
  where cliente_telefone = v_telefone
    and status = 'aguardando_pagamento'
    and pagamento_status = 'pendente'
    and created_at > now() - interval '15 minutes';
  if v_pendentes >= 3 then
    raise exception 'limite_pedidos_pendentes' using errcode = 'P0001';
  end if;

  -- Cliente identificado por telefone (guarda o nome mais recente).
  insert into public.clientes (nome, telefone)
  values (v_pedido ->> 'cliente_nome', v_telefone)
  on conflict (telefone) do update set nome = excluded.nome
  returning id into v_cliente_id;

  -- Status, pagamento e canal são definidos AQUI: o que vier no JSON para esses campos é ignorado.
  insert into public.pedidos (
    id, canal, cliente_id, cliente_nome, cliente_telefone, tipo, status, pagamento_status,
    pagamento_metodo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade,
    endereco_complemento, endereco_referencia, distancia_km, subtotal_centavos,
    taxa_entrega_centavos, desconto_centavos, total_centavos, observacoes
  )
  select
    v_id, 'proprio', v_cliente_id, r.cliente_nome, r.cliente_telefone, r.tipo,
    'aguardando_pagamento', 'pendente', r.pagamento_metodo, r.endereco_rua, r.endereco_numero,
    r.endereco_bairro, r.endereco_cidade, r.endereco_complemento, r.endereco_referencia,
    r.distancia_km, r.subtotal_centavos, coalesce(r.taxa_entrega_centavos, 0),
    coalesce(r.desconto_centavos, 0), r.total_centavos, r.observacoes
  from jsonb_populate_record(null::public.pedidos, v_pedido) r;

  insert into public.itens_pedido (
    id, pedido_id, produto_id, nome, quantidade, preco_unitario_centavos, total_centavos, observacoes
  )
  select i.id, v_id, i.produto_id, i.nome, i.quantidade, i.preco_unitario_centavos,
         i.total_centavos, i.observacoes
  from jsonb_populate_recordset(null::public.itens_pedido, p -> 'itens') i;

  -- Todo componente precisa pertencer a um item DESTE pedido.
  if exists (
    select 1
    from jsonb_populate_recordset(
      null::public.itens_pedido_componentes, coalesce(p -> 'componentes', '[]'::jsonb)
    ) c
    where not exists (
      select 1 from public.itens_pedido ip
      where ip.id = c.item_pedido_id and ip.pedido_id = v_id
    )
  ) then
    raise exception 'componente_fora_do_pedido' using errcode = 'P0001';
  end if;

  insert into public.itens_pedido_componentes (
    id, item_pedido_id, produto_id, grupo_nome, opcao_nome, quantidade, preco_adicional_centavos
  )
  select c.id, c.item_pedido_id, c.produto_id, c.grupo_nome, c.opcao_nome, c.quantidade,
         c.preco_adicional_centavos
  from jsonb_populate_recordset(
    null::public.itens_pedido_componentes, coalesce(p -> 'componentes', '[]'::jsonb)
  ) c;

  -- Última barreira: os itens têm que somar exatamente o subtotal do pedido.
  select coalesce(sum(total_centavos), 0) into v_soma
  from public.itens_pedido where pedido_id = v_id;
  if v_soma <> (v_pedido ->> 'subtotal_centavos')::bigint then
    raise exception 'totais_inconsistentes' using errcode = 'P0001';
  end if;

  return query
    select ped.id, ped.numero, ped.token_acompanhamento
    from public.pedidos ped where ped.id = v_id;
end;
$$;

-- Só o servidor (service role) executa. Sem isso qualquer visitante criaria pedido direto pela API.
revoke all on function public.criar_pedido(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.criar_pedido(jsonb) to service_role;
  end if;
end
$$;

-- Acompanhamento SEM login: o cliente informa o token e recebe só o mínimo (nada de telefone nem endereço).
-- (Não chamar de status_pedido: já existe um TIPO com esse nome e o Postgres confundiria com um cast.)
create or replace function public.acompanhar_pedido(p_token uuid)
returns table (
  numero bigint,
  tipo public.tipo_entrega,
  status public.status_pedido,
  pagamento_status public.status_pagamento,
  total_centavos integer,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.numero, p.tipo, p.status, p.pagamento_status, p.total_centavos, p.created_at
  from public.pedidos p
  where p.token_acompanhamento = p_token;
$$;

revoke all on function public.acompanhar_pedido(uuid) from public;
grant execute on function public.acompanhar_pedido(uuid) to anon, authenticated;
