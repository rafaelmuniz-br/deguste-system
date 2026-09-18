-- Preço "de/por": guarda o preço riscado (original) quando o item está com desconto
-- (tarefa 2.12). É só para EXIBIÇÃO — o total do pedido sempre usa `preco_centavos`,
-- nunca este campo.

alter table public.produtos
  add column preco_original_centavos integer
    check (preco_original_centavos is null or preco_original_centavos > preco_centavos);
