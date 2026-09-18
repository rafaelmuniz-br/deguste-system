-- Relatórios de vendas (tarefa 6.2). Uma função só devolve tudo que a tela precisa, em JSON:
--   resumo, vendas por dia, por canal, por tipo (entrega/retirada), por hora de pico e produtos mais vendidos.
--
-- Regras (para todos os números fazerem sentido juntos):
--   * "Venda" = pedido PAGO e não cancelado. Cancelados aparecem à parte, só como contagem.
--   * Datas e horas no fuso America/Bahia (não no fuso do servidor).
--   * Produtos: contam pelo produto_id REAL (D3). Um combo com "escolha seu hambúrguer" conta uma unidade do
--     hambúrguer escolhido (componente) e uma do combo; o mesmo hambúrguer vendido avulso soma na mesma linha.
--     A receita só é atribuída ao que foi vendido AVULSO (o preço do combo é um valor fechado e não dá para
--     dividir por produto sem inventar número); por isso vem separada em `receita_avulsa_centavos`.
--
-- `security invoker`: o RLS continua valendo (só admin lê pedidos); a checagem abaixo só dá mensagem clara.

create or replace function public.relatorio_vendas(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  if p_fim - p_inicio > 366 then
    raise exception 'periodo_longo_demais' using errcode = '22023';
  end if;

  with pedidos_do_periodo as (
    select
      p.id, p.canal, p.tipo, p.status, p.pagamento_status, p.total_centavos,
      (p.created_at at time zone 'America/Bahia')::date as dia,
      extract(hour from p.created_at at time zone 'America/Bahia')::int as hora
    from public.pedidos p
    where (p.created_at at time zone 'America/Bahia')::date between p_inicio and p_fim
  ),
  vendas as (
    select * from pedidos_do_periodo
    where pagamento_status = 'pago' and status <> 'cancelado'
  ),
  linhas_de_produto as (
    -- linha vendida diretamente: produto avulso (com receita) ou o próprio combo (sem receita por produto)
    select
      i.produto_id,
      i.quantidade as unidades,
      0 as em_combo,
      case when pr.eh_combo then 0 else i.total_centavos end as receita_avulsa
    from public.itens_pedido i
    join vendas v on v.id = i.pedido_id
    join public.produtos pr on pr.id = i.produto_id
    union all
    -- produtos reais escolhidos dentro de combos (ex.: o hambúrguer do combo)
    select k.produto_id, i.quantidade * k.quantidade, i.quantidade * k.quantidade, 0
    from public.itens_pedido_componentes k
    join public.itens_pedido i on i.id = k.item_pedido_id
    join vendas v on v.id = i.pedido_id
    where k.produto_id is not null
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
    'resumo', jsonb_build_object(
      'pedidos', (select count(*) from vendas),
      'receita_centavos', (select coalesce(sum(total_centavos), 0) from vendas),
      'ticket_medio_centavos', (select coalesce(round(avg(total_centavos)), 0)::bigint from vendas),
      'cancelados', (select count(*) from pedidos_do_periodo where status = 'cancelado')
    ),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', dia, 'pedidos', n, 'receita_centavos', r) order by dia)
      from (select dia, count(*) n, sum(total_centavos) r from vendas group by dia) t
    ), '[]'::jsonb),
    'por_canal', coalesce((
      select jsonb_agg(jsonb_build_object('canal', canal, 'pedidos', n, 'receita_centavos', r) order by r desc)
      from (select canal, count(*) n, sum(total_centavos) r from vendas group by canal) t
    ), '[]'::jsonb),
    'por_tipo', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', tipo, 'pedidos', n, 'receita_centavos', r) order by r desc)
      from (select tipo, count(*) n, sum(total_centavos) r from vendas group by tipo) t
    ), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', hora, 'pedidos', n) order by hora)
      from (select hora, count(*) n from vendas group by hora) t
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'produto_id', l.produto_id,
          'nome', pr.nome,
          'unidades', l.unidades,
          'unidades_em_combo', l.em_combo,
          'receita_avulsa_centavos', l.receita
        ) order by l.unidades desc, pr.nome
      )
      from (
        select produto_id, sum(unidades) unidades, sum(em_combo) em_combo, sum(receita_avulsa) receita
        from linhas_de_produto group by produto_id
      ) l
      join public.produtos pr on pr.id = l.produto_id
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.relatorio_vendas(date, date) from public, anon;
grant execute on function public.relatorio_vendas(date, date) to authenticated;
