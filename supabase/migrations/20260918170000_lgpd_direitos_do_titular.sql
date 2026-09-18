-- Direitos do titular (LGPD, art. 18) — tarefa 3.13.
--   exportar_dados_cliente(telefone): acesso e portabilidade (o que temos sobre a pessoa).
--   anonimizar_cliente(telefone):     eliminação, mantendo os pedidos SEM dados pessoais (os registros
--                                     de venda seguem existindo para relatórios e obrigações fiscais).
--
-- Quem executa: uma pessoa autorizada da loja, no SQL Editor do Supabase, ou o servidor (service role).
-- Nunca o navegador do cliente (execute revogado). Procedimento completo em docs/lgpd-direitos.md.

create or replace function public.exportar_dados_cliente(p_telefone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exportado_em', now(),
    'cliente', (select to_jsonb(c) - 'id' from public.clientes c where c.telefone = p_telefone),
    'pedidos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'numero', p.numero,
          'data', p.created_at,
          'tipo', p.tipo,
          'status', p.status,
          'pagamento', p.pagamento_status,
          'nome_no_pedido', p.cliente_nome,
          'telefone_no_pedido', p.cliente_telefone,
          'endereco', jsonb_build_object(
            'rua', p.endereco_rua, 'numero', p.endereco_numero, 'bairro', p.endereco_bairro,
            'cidade', p.endereco_cidade, 'complemento', p.endereco_complemento,
            'referencia', p.endereco_referencia
          ),
          'observacoes', p.observacoes,
          'subtotal_centavos', p.subtotal_centavos,
          'taxa_entrega_centavos', p.taxa_entrega_centavos,
          'desconto_centavos', p.desconto_centavos,
          'total_centavos', p.total_centavos,
          'itens', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'nome', i.nome, 'quantidade', i.quantidade, 'total_centavos', i.total_centavos,
              'observacoes', i.observacoes
            )), '[]'::jsonb)
            from public.itens_pedido i where i.pedido_id = p.id
          )
        ) order by p.created_at
      )
      from public.pedidos p where p.cliente_telefone = p_telefone
    ), '[]'::jsonb),
    'saldo_cashback_centavos', coalesce((
      select sum(m.valor_centavos)
      from public.cashback_movimentos m
      join public.clientes c on c.id = m.cliente_id
      where c.telefone = p_telefone
    ), 0)
  );
$$;

create or replace function public.anonimizar_cliente(p_telefone text)
returns table (pedidos_anonimizados integer, cliente_removido boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedidos integer;
  v_apagados integer;
  v_removido boolean;
begin
  -- Não mexe em pedido que ainda está sendo atendido (a entrega precisa do endereço e do telefone).
  if exists (
    select 1 from public.pedidos
    where cliente_telefone = p_telefone and status not in ('concluido', 'cancelado')
  ) then
    raise exception 'pedido_em_andamento' using errcode = 'P0001';
  end if;

  -- Observações dos itens podem ter dado pessoal ("entregar para a Maria"): limpa ANTES, enquanto
  -- ainda dá para achar os pedidos pelo telefone.
  update public.itens_pedido set observacoes = null
  where observacoes is not null
    and pedido_id in (select id from public.pedidos where cliente_telefone = p_telefone);

  -- Pedidos ficam (histórico de vendas e obrigações fiscais), sem dado que identifique a pessoa.
  -- O bairro fica: sozinho não identifica ninguém e permite relatório por região.
  update public.pedidos set
    cliente_nome = 'Cliente removido',
    cliente_telefone = 'removido',
    endereco_rua = case when endereco_rua is null then null else '(removido)' end,
    endereco_numero = null,
    endereco_complemento = null,
    endereco_referencia = null,
    endereco_latitude = null,
    endereco_longitude = null,
    observacoes = null,
    cliente_id = null
  where cliente_telefone = p_telefone;
  get diagnostics v_pedidos = row_count;

  -- Remove o cadastro (o saldo de cashback vai junto, por cascata).
  delete from public.clientes where telefone = p_telefone;
  get diagnostics v_apagados = row_count; -- (GET DIAGNOSTICS não aceita expressão)
  v_removido := v_apagados > 0;

  return query select v_pedidos, v_removido;
end;
$$;

-- Só quem administra o banco (SQL Editor) ou o servidor (service role). Nunca visitante nem usuário logado.
revoke all on function public.exportar_dados_cliente(text) from public, anon, authenticated;
revoke all on function public.anonimizar_cliente(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.exportar_dados_cliente(text) to service_role;
    grant execute on function public.anonimizar_cliente(text) to service_role;
  end if;
end
$$;
