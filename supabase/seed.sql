-- Dados de EXEMPLO para desenvolvimento. NUNCA rodar em produção
-- (o cardápio real entra por script próprio — tarefa 2.2 do plano).

insert into public.categorias (id, nome, ordem) values
  ('00000000-0000-4000-8000-000000000001', 'Ofertas com Desconto', 1),
  ('00000000-0000-4000-8000-000000000002', 'Smashs 90g Black Angus', 2),
  ('00000000-0000-4000-8000-000000000003', 'Burguers 180g Black Angus', 3),
  ('00000000-0000-4000-8000-000000000004', 'Bebidas', 4);

insert into public.produtos (id, categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem) values
  ('00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8000-000000000002',
    'Smash Exemplo', 'Produto de exemplo para desenvolvimento.', 2199, 2799, false, 1),
  ('00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8000-000000000003',
    'Burguer Exemplo', 'Produto de exemplo para desenvolvimento.', 3399, null, false, 1),
  ('00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8000-000000000004',
    'Refrigerante Exemplo', 'Lata 350ml.', 700, null, false, 1),
  ('00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8000-000000000001',
    'Combo Exemplo', 'Escolha um hambúrguer + refrigerante.', 3999, null, true, 1);

-- Adicional simples no Smash: bacon extra.
insert into public.grupos_opcao (id, produto_id, nome, min_escolhas, max_escolhas, ordem) values
  ('00000000-0000-4000-8002-000000000001', '00000000-0000-4000-8001-000000000001', 'Adicionais', 0, 3, 1),
  ('00000000-0000-4000-8002-000000000002', '00000000-0000-4000-8001-000000000004', 'Escolha seu hambúrguer', 1, 1, 1);

insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
  ('00000000-0000-4000-8002-000000000001', 'Bacon extra', 400, null, 1),
  ('00000000-0000-4000-8002-000000000001', 'Queijo extra', 300, null, 2),
  -- Combo: cada opção aponta para o produto REAL escolhido (relatórios corretos).
  ('00000000-0000-4000-8002-000000000002', 'Smash Exemplo', 0, '00000000-0000-4000-8001-000000000001', 1),
  ('00000000-0000-4000-8002-000000000002', 'Burguer Exemplo', 800, '00000000-0000-4000-8001-000000000002', 2);

update public.configuracoes_loja set
  endereco = 'Salvador, BA (definir endereço real)',
  frete_base_centavos = 500,
  frete_por_km_centavos = 150,
  raio_maximo_km = 6;
