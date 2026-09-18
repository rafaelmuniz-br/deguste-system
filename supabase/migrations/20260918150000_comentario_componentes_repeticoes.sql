-- Corrige o comentário de itens_pedido_componentes.quantidade depois da tarefa 2.11
-- (uma opção pode ser escolhida mais de uma vez no mesmo grupo). Só documentação: não muda dados.

comment on column public.itens_pedido_componentes.quantidade is
  'Unidades TOTAIS desta opção na linha: quantidade do item x quantas vezes a opção foi escolhida. Ex.: 2 combos com 3x Jackfino gera componente Jackfino com quantidade 6, então somar por produto_id dá as vendas reais.';
