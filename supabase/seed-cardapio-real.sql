-- Carga do cardápio REAL da Deguste Burguer (tarefa 2.2), a partir do levantamento conferido em
-- docs/levantamento-cardapio.md (site oficial + relatório de produtos, 18/09/2026).
--
-- Roda UMA VEZ em cada banco (dev agora; produção mais perto do go-live). Remove primeiro os
-- produtos/categorias de EXEMPLO (supabase/seed.sql) para não conviver com o cardápio real.
--
-- Simplificações conscientes (revisar com o Bruno antes de produção — ver "Perguntas em aberto"
-- em docs/levantamento-cardapio.md):
--   * Grupo "Molho" do monte-o-seu: o site mostra contador "0/1" mas o texto diz "1 a 2"; aqui
--     vale o texto (min 1, max 2).
--   * "Brownie de Chocolate" NÃO entra (nem avulso nem como opção de sobremesa nos combos): ele
--     aparece "Inativo" no relatório de produtos, mesmo mostrando como opção em alguns combos no
--     site. Fica de fora até o Bruno confirmar se volta ao cardápio.
--   * "Batata Trips com cheddar" / "com aioli" (opções dentro de combos) apontam para o mesmo
--     produto avulso "Batata Trips" — é a mesma fritura, só muda o molho; mantém os relatórios
--     por produto corretos sem inventar dois produtos que não existem separados no cardápio.
--   * Nos combos "Jackfino" e "Boladão" o hambúrguer é fixo, mas mesmo assim ganha um grupo com
--     UMA opção obrigatória (o próprio hambúrguer) — sem isso a venda dele dentro do combo não
--     apontaria para um produto real e sumiria dos relatórios por produto (D3 do plano).

do $$
declare
  -- categorias
  v_cat_ofertas uuid;
  v_cat_smash uuid;
  v_cat_burguer uuid;
  v_cat_entradas uuid;
  v_cat_bebidas uuid;
  -- smashs
  v_jackfino uuid;
  v_laurinha uuid;
  v_bolado uuid;
  v_xeque uuid;
  v_degorgson uuid;
  v_monte_smash uuid;
  -- burguers
  v_padrao uuid;
  v_jackmelt uuid;
  v_salada uuid;
  v_boladao uuid;
  v_dilica uuid;
  v_gorgonelson uuid;
  v_baconzord uuid;
  v_monte_burguer uuid;
  -- entradas e sobremesas
  v_batata_frita uuid;
  v_onion_rings uuid;
  v_batata_trips uuid;
  v_brownie_ninho uuid;
  v_dois_brownies uuid;
  v_pote_cheddar uuid;
  v_pote_aioli uuid;
  v_pote_degsauce uuid;
  v_pote_barbecue uuid;
  -- bebidas
  v_coca uuid;
  v_coca_zero uuid;
  v_guarana uuid;
  v_guarana_zero uuid;
  v_agua_sem uuid;
  v_agua_com uuid;
  -- combos
  v_combo_brownie uuid;
  v_combo_brownie_bebida uuid;
  v_combo_3smash uuid;
  v_combo_4smash uuid;
  v_combo_jackfino uuid;
  v_combo_boladao uuid;
  -- reutilizada a cada grupo de opção
  v_grupo uuid;
begin
  -- 1) Remove o cardápio de EXEMPLO (supabase/seed.sql) — cascade limpa grupos_opcao/opcoes, mas
  -- opcoes.produto_id (a opção do combo que aponta pro Smash/Burguer Exemplo) é "on delete restrict":
  -- precisa apagar essa referência primeiro.
  delete from public.opcoes where produto_id in (
    '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000002',
    '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8001-000000000004'
  );
  delete from public.produtos where id in (
    '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8001-000000000002',
    '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8001-000000000004'
  );
  delete from public.categorias where id in (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'
  );

  -- 2) Categorias
  insert into public.categorias (nome, ordem) values ('Ofertas com Desconto', 1) returning id into v_cat_ofertas;
  insert into public.categorias (nome, ordem) values ('Smashs 90g Black Angus', 2) returning id into v_cat_smash;
  insert into public.categorias (nome, ordem) values ('Burguers 180g Black Angus', 3) returning id into v_cat_burguer;
  insert into public.categorias (nome, ordem) values ('Entradas e Sobremesas', 4) returning id into v_cat_entradas;
  insert into public.categorias (nome, ordem) values ('Bebidas', 5) returning id into v_cat_bebidas;

  -- 3) Smashs 90g Black Angus
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, ordem)
    values (v_cat_smash, 'Jackfino', 'Smash 90g de Black Angus, cheddar cremoso, bacon crocante e nosso molho especial deg''s sauce', 2299, 2799, 1)
    returning id into v_jackfino;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_smash, 'Laurinha', 'Smash 90g de Black Angus, queijo prato derretido, salada (cebola fininha, alface crocante e tomate), picles de pepino e nosso molho especial deg''s sauce', 2299, 2)
    returning id into v_laurinha;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_smash, 'Bolado', 'Smash 90g de Black Angus, cheddar cremoso, bacon crocante, onion ring e nossa maionese de alho (aioli)', 2399, 3)
    returning id into v_bolado;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_smash, 'Xeque Mate', 'Smash 90g de Black Angus, queijo do reino derretido, cebola caramelizada e nossa maionese de alho (aioli)', 2499, 4)
    returning id into v_xeque;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_smash, 'Degorgson', 'Smash 90g de Black Angus, gorgonzola, geleia de bacon e nossa maionese de alho (aioli)', 2699, 5)
    returning id into v_degorgson;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_smash, 'Monte o seu Smash', 'Smash 90g de Black Angus! Escolha seu queijo e molho! Tudo pode ser adicionado, para ficar do seu jeito!', 2199, 6)
    returning id into v_monte_smash;

  -- 4) Burguers 180g Black Angus
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Padrão', '180g de Black Angus, queijo prato derretido, bacon crocante, cebola caramelizada e nossa maionese de alho (aioli)', 3599, 1)
    returning id into v_padrao;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Jackmelt', '180g de Black Angus, cheddar cremoso, bacon crocante, cebola caramelizada e nossa maionese de alho (aioli)', 3599, 2)
    returning id into v_jackmelt;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Salada', '180g de Black Angus, queijo prato derretido, salada (cebola fininha, alface crocante e tomate), picles de pepino e nosso molho especial deg''s sauce', 3599, 3)
    returning id into v_salada;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Boladão', '180g de Black Angus, cheddar cremoso, bacon crocante, onion ring, barbecue e nossa maionese de alho (aioli)', 3699, 4)
    returning id into v_boladao;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Diliça', '180g de Black Angus, queijo do reino derretido, geleia de bacon e nossa maionese de alho (aioli)', 3799, 5)
    returning id into v_dilica;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Gorgonelson', '180g de Black Angus, gorgonzola, bacon crocante, cebola caramelizada, onion ring e nossa maionese de alho (aioli)', 3799, 6)
    returning id into v_gorgonelson;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Baconzord', '180g de Black Angus, cheddar cremoso, bacon crocante, cebola caramelizada, picles e molho barbecue', 3799, 7)
    returning id into v_baconzord;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_burguer, 'Monte o seu Burguer', '180g de Black Angus! Escolha seu queijo e molho! Tudo pode ser adicionado, para ficar do seu jeito!', 3399, 8)
    returning id into v_monte_burguer;

  -- 5) Entradas e Sobremesas
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Batata frita', '150g de deliciosas batatas fritas crocantes e sequinhas!', 1699, 1)
    returning id into v_batata_frita;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Onion Rings', 'Deliciosa porção com 10 anéis de cebola acompanhada de um pote de aioli', 2099, 2)
    returning id into v_onion_rings;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Batata Trips', '350g de deliciosas batatas fritas sequinhas e crocantes, regada com duas camadas de cheddar ou aioli e uma de bacon crocante!', 3299, 3)
    returning id into v_batata_trips;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Brownie de Ninho', 'Duas camadas de brownie e recheio de Ninho', 1299, 4)
    returning id into v_brownie_ninho;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, ordem)
    values (v_cat_entradas, 'Dois Brownies', 'Duas fatias de Brownie de Ninho, com desconto no combo', 2198, 2598, 5)
    returning id into v_dois_brownies;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Cheddar', 'Pote 30ml', 699, 6)
    returning id into v_pote_cheddar;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Aioli', 'Nossa deliciosa maionese a base de alho (pote 30ml)', 299, 7)
    returning id into v_pote_aioli;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Deg''s sauce', 'Nosso delicioso molho secreto pra smash! (Pote 30ml)', 299, 8)
    returning id into v_pote_degsauce;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_entradas, 'Barbecue', 'Pote 30ml', 299, 9)
    returning id into v_pote_barbecue;

  -- 6) Bebidas
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Coca-Cola lata', '350mL', 799, 1) returning id into v_coca;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Coca-Cola Zero lata', '350mL', 799, 2) returning id into v_coca_zero;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Guaraná Antarctica lata', '350mL', 799, 3) returning id into v_guarana;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Guaraná Antarctica Zero lata', '350mL', 799, 4) returning id into v_guarana_zero;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Água sem Gás', '500mL', 599, 5) returning id into v_agua_sem;
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, ordem)
    values (v_cat_bebidas, 'Água com Gás', '500mL', 599, 6) returning id into v_agua_com;

  -- 7) Grupos de opção do "Monte o seu Smash" (único smash com escolhas)
  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Queijo', 1, 1, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Queijo Prato', 0, 1),
    (v_grupo, 'Cheddar', 0, 2),
    (v_grupo, 'Queijo do Reino', 199, 3),
    (v_grupo, 'Creme de Gorgonzola', 199, 4),
    (v_grupo, 'Sem queijo', 0, 5);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Molho', 1, 2, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Sem molho', 0, 1),
    (v_grupo, 'Aioli', 0, 2),
    (v_grupo, 'Deg''s sauce', 0, 3),
    (v_grupo, 'Barbecue', 0, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Adicionais', 0, 10, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Smash de 90g Black Angus extra', 750, 1),
    (v_grupo, 'Bacon', 499, 2),
    (v_grupo, 'Geleia de bacon', 599, 3),
    (v_grupo, 'Cebola caramelizada', 299, 4),
    (v_grupo, 'Onion ring', 499, 5),
    (v_grupo, 'Picles de pepino', 199, 6),
    (v_grupo, 'Alface americano', 99, 7),
    (v_grupo, 'Tomate', 99, 8),
    (v_grupo, 'Cebola fininha', 99, 9);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Entrada', 0, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 1499, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 1799, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 2899, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 2899, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Bebida', 0, 1, 5) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 599, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 599, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 599, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 599, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 599, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 599, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_smash, 'Sobremesa', 0, 1, 6) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 1099, v_brownie_ninho, 1);

  -- 8) Grupos de opção do "Monte o seu Burguer" (mesma estrutura; só muda o 1º item de Adicionais)
  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Queijo', 1, 1, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Queijo Prato', 0, 1),
    (v_grupo, 'Cheddar', 0, 2),
    (v_grupo, 'Queijo do Reino', 199, 3),
    (v_grupo, 'Creme de Gorgonzola', 199, 4),
    (v_grupo, 'Sem queijo', 0, 5);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Molho', 1, 2, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Sem molho', 0, 1),
    (v_grupo, 'Aioli', 0, 2),
    (v_grupo, 'Deg''s sauce', 0, 3),
    (v_grupo, 'Barbecue', 0, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Adicionais', 0, 10, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, ordem) values
    (v_grupo, 'Burguer de 180g Black Angus extra', 1500, 1),
    (v_grupo, 'Bacon', 499, 2),
    (v_grupo, 'Geleia de bacon', 599, 3),
    (v_grupo, 'Cebola caramelizada', 299, 4),
    (v_grupo, 'Onion ring', 499, 5),
    (v_grupo, 'Picles de pepino', 199, 6),
    (v_grupo, 'Alface americano', 99, 7),
    (v_grupo, 'Tomate', 99, 8),
    (v_grupo, 'Cebola fininha', 99, 9);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Entrada', 0, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 1499, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 1799, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 2899, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 2899, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Bebida', 0, 1, 5) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 599, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 599, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 599, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 599, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 599, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 599, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_monte_burguer, 'Sobremesa', 0, 1, 6) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 1099, v_brownie_ninho, 1);

  -- 9) Combo Brownie Grátis (47,97 de 60,96) — hambúrguer + entrada + bebida + sobremesa, tudo incluso
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (v_cat_ofertas, 'Combo Brownie Grátis', 'Hambúrguer suculento, batata crocante, bebida gelada e brownie grátis pra finalizar', 4797, 6096, true, 1)
    returning id into v_combo_brownie;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie, 'Hambúrguer', 1, 1, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Jackfino', 0, v_jackfino, 1),
    (v_grupo, 'Laurinha', 0, v_laurinha, 2),
    (v_grupo, 'Bolado', 100, v_bolado, 3),
    (v_grupo, 'Xeque Mate', 200, v_xeque, 4),
    (v_grupo, 'Degorgson', 400, v_degorgson, 5),
    (v_grupo, 'Padrão', 1500, v_padrao, 6),
    (v_grupo, 'Jackmelt', 1500, v_jackmelt, 7),
    (v_grupo, 'Salada', 1500, v_salada, 8),
    (v_grupo, 'Boladão', 1600, v_boladao, 9),
    (v_grupo, 'Diliça', 1700, v_dilica, 10),
    (v_grupo, 'Gorgonelson', 1700, v_gorgonelson, 11),
    (v_grupo, 'Baconzord', 1700, v_baconzord, 12);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie, 'Entrada', 1, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 0, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 400, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 1600, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 1600, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie, 'Bebida', 1, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 0, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 0, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 0, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 0, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 0, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 0, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie, 'Sobremesa', 1, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 0, v_brownie_ninho, 1);

  -- 10) Combo Brownie+Bebida Grátis (62,97 de 83,95) — mesma estrutura, mas 2 hambúrgueres (repetível)
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (v_cat_ofertas, 'Combo Brownie+Bebida Grátis', '2 hambúrgueres suculentos, batata crocante + bebida grátis e brownie grátis pra fechar', 6297, 8395, true, 2)
    returning id into v_combo_brownie_bebida;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie_bebida, 'Hambúrguer', 2, 2, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Jackfino', 0, v_jackfino, 1),
    (v_grupo, 'Laurinha', 0, v_laurinha, 2),
    (v_grupo, 'Bolado', 100, v_bolado, 3),
    (v_grupo, 'Xeque Mate', 200, v_xeque, 4),
    (v_grupo, 'Degorgson', 400, v_degorgson, 5),
    (v_grupo, 'Padrão', 1500, v_padrao, 6),
    (v_grupo, 'Jackmelt', 1500, v_jackmelt, 7),
    (v_grupo, 'Salada', 1500, v_salada, 8),
    (v_grupo, 'Boladão', 1600, v_boladao, 9),
    (v_grupo, 'Diliça', 1700, v_dilica, 10),
    (v_grupo, 'Gorgonelson', 1700, v_gorgonelson, 11),
    (v_grupo, 'Baconzord', 1700, v_baconzord, 12);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie_bebida, 'Entrada', 1, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 0, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 400, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 1600, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 1600, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie_bebida, 'Bebida', 1, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 0, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 0, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 0, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 0, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 0, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 0, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_brownie_bebida, 'Sobremesa', 1, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 0, v_brownie_ninho, 1);

  -- 11) Combo 3 Smashs 90g (58,63 de 68,97) — 3 smashs obrigatórios (repetível) + upsell opcional pago
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (v_cat_ofertas, 'Combo 3 Smashs 90g', '3 Smashs 90g Black Angus', 5863, 6897, true, 3)
    returning id into v_combo_3smash;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_3smash, 'Smashs', 3, 3, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Jackfino', 0, v_jackfino, 1),
    (v_grupo, 'Laurinha', 0, v_laurinha, 2),
    (v_grupo, 'Bolado', 100, v_bolado, 3),
    (v_grupo, 'Xeque Mate', 200, v_xeque, 4),
    (v_grupo, 'Degorgson', 400, v_degorgson, 5);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_3smash, 'Entrada (opcional, pago à parte)', 0, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 1499, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 1799, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 2899, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 2899, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_3smash, 'Bebida (opcional, paga à parte)', 0, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 599, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 599, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 599, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 599, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 599, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 599, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_3smash, 'Sobremesa (opcional, paga à parte)', 0, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 1099, v_brownie_ninho, 1);

  -- 12) Combo 4 Smashs 90g (78,17 de 91,96) — mesma estrutura do combo de 3, escolhendo 4
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (v_cat_ofertas, 'Combo 4 Smashs 90g', '4 Smashs 90g Black Angus', 7817, 9196, true, 4)
    returning id into v_combo_4smash;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_4smash, 'Smashs', 4, 4, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Jackfino', 0, v_jackfino, 1),
    (v_grupo, 'Laurinha', 0, v_laurinha, 2),
    (v_grupo, 'Bolado', 100, v_bolado, 3),
    (v_grupo, 'Xeque Mate', 200, v_xeque, 4),
    (v_grupo, 'Degorgson', 400, v_degorgson, 5);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_4smash, 'Entrada (opcional, pago à parte)', 0, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 1499, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 1799, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 2899, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 2899, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_4smash, 'Bebida (opcional, paga à parte)', 0, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 599, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 599, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 599, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 599, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 599, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 599, v_agua_sem, 6);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_4smash, 'Sobremesa (opcional, paga à parte)', 0, 1, 4) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Brownie de Ninho', 1099, v_brownie_ninho, 1);

  -- 13) Combo do Jackfino (43,32 de 50,97) — hambúrguer fixo (Jackfino) + entrada + bebida inclusas
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (
      v_cat_ofertas, 'Combo do Jackfino',
      'Batata + Bebida + Smash 90g de Black Angus, cheddar cremoso, bacon crocante e nosso molho especial deg''s sauce',
      4332, 5097, true, 5
    )
    returning id into v_combo_jackfino;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_jackfino, 'Hambúrguer', 1, 1, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Jackfino', 0, v_jackfino, 1);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_jackfino, 'Entrada', 1, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 0, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 400, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 1600, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 1600, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_jackfino, 'Bebida', 1, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 0, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 0, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 0, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 0, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 0, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 0, v_agua_sem, 6);

  -- 14) Combo do Boladão (56,00 de 65,97) — mesma estrutura do Combo do Jackfino, hambúrguer = Boladão
  insert into public.produtos (categoria_id, nome, descricao, preco_centavos, preco_original_centavos, eh_combo, ordem)
    values (
      v_cat_ofertas, 'Combo do Boladão',
      'Batata + Bebida + Burguer 180g Black Angus, cheddar cremoso, bacon crocante, onion ring, barbecue e nossa maionese de alho (aioli)',
      5600, 6597, true, 6
    )
    returning id into v_combo_boladao;

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_boladao, 'Hambúrguer', 1, 1, 1) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Boladão', 0, v_boladao, 1);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_boladao, 'Entrada', 1, 1, 2) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Batata frita', 0, v_batata_frita, 1),
    (v_grupo, 'Onion Rings', 400, v_onion_rings, 2),
    (v_grupo, 'Batata Trips com cheddar', 1600, v_batata_trips, 3),
    (v_grupo, 'Batata Trips com aioli', 1600, v_batata_trips, 4);

  insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas, ordem)
    values (v_combo_boladao, 'Bebida', 1, 1, 3) returning id into v_grupo;
  insert into public.opcoes (grupo_id, nome, preco_adicional_centavos, produto_id, ordem) values
    (v_grupo, 'Coca-Cola Lata', 0, v_coca, 1),
    (v_grupo, 'Coca-Cola Zero Lata', 0, v_coca_zero, 2),
    (v_grupo, 'Guaraná Antarctica Lata', 0, v_guarana, 3),
    (v_grupo, 'Guaraná Antarctica Zero Lata', 0, v_guarana_zero, 4),
    (v_grupo, 'Água com Gás', 0, v_agua_com, 5),
    (v_grupo, 'Água sem Gás', 0, v_agua_sem, 6);

end $$;
