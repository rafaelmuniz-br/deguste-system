-- Documenta no próprio banco o significado de colunas que já geraram dúvida de interpretação.

comment on column public.itens_pedido.preco_unitario_centavos is
  'Preço por unidade JÁ com adicionais (produto + opções), calculado no servidor.';

comment on column public.itens_pedido_componentes.quantidade is
  'Unidades TOTAIS da linha (quantidade do item x 1). Ex.: 2 combos com Jackfino gera componente Jackfino com quantidade 2, então somar por produto_id dá as vendas reais.';

comment on column public.pedidos.distancia_km is
  'Distância por ruas da loja até o cliente usada no cálculo do frete (2 casas).';
