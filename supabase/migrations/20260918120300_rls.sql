-- Row Level Security em TODAS as tabelas (regra do projeto).
--
-- Modelo:
--   * Público (anon/authenticated): só LÊ o cardápio ativo e a configuração da loja.
--   * Admin (tabela public.admins): lê e escreve tudo.
--   * Pedidos, clientes, cupons e cashback: nenhum acesso público. Pedidos são criados
--     por Netlify Functions com a service role (que ignora o RLS), depois de recalcular
--     preços no servidor.

alter table public.admins enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.grupos_opcao enable row level security;
alter table public.opcoes enable row level security;
alter table public.configuracoes_loja enable row level security;
alter table public.horarios_funcionamento enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.itens_pedido_componentes enable row level security;
alter table public.cupons enable row level security;
alter table public.cashback_movimentos enable row level security;

-- Defesa em profundidade: mesmo que uma política seja criada errada, o público
-- não tem permissão de tabela nas áreas sensíveis.
revoke all on public.admins from anon, authenticated;
revoke all on public.clientes from anon;
revoke all on public.pedidos from anon;
revoke all on public.itens_pedido from anon;
revoke all on public.itens_pedido_componentes from anon;
revoke all on public.cupons from anon;
revoke all on public.cashback_movimentos from anon;
-- O público só lê o cardápio: nunca escreve.
revoke insert, update, delete on
  public.categorias, public.produtos, public.grupos_opcao, public.opcoes,
  public.configuracoes_loja, public.horarios_funcionamento
from anon;

-- admins: cada usuário só enxerga a própria linha (para o app saber se é admin).
grant select on public.admins to authenticated;
create policy admins_ler_propria on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- Leitura pública do cardápio ativo.
create policy categorias_leitura_publica on public.categorias
  for select to anon, authenticated using (ativo);
create policy produtos_leitura_publica on public.produtos
  for select to anon, authenticated using (ativo);
create policy grupos_opcao_leitura_publica on public.grupos_opcao
  for select to anon, authenticated using (
    exists (select 1 from public.produtos p where p.id = produto_id and p.ativo)
  );
create policy opcoes_leitura_publica on public.opcoes
  for select to anon, authenticated using (ativo);
create policy configuracoes_leitura_publica on public.configuracoes_loja
  for select to anon, authenticated using (true);
create policy horarios_leitura_publica on public.horarios_funcionamento
  for select to anon, authenticated using (true);

-- Admin: acesso total a todas as tabelas de negócio.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'produtos', 'grupos_opcao', 'opcoes', 'configuracoes_loja',
    'horarios_funcionamento', 'clientes', 'pedidos', 'itens_pedido',
    'itens_pedido_componentes', 'cupons', 'cashback_movimentos'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_total', t
    );
  end loop;
end
$$;

-- Tempo real: o painel da cozinha (admin) recebe pedidos novos. O Realtime respeita o RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end
$$;
