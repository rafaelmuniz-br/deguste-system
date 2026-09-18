# Como um pedido é criado (arquitetura)

```text
Navegador ──► Netlify Function (servidor) ──► Supabase (banco)
  só envia        recalcula tudo,               função criar_pedido:
  "o que o        valida, chama o               grava cliente + pedido + itens
  cliente quer"   banco com a service role      + componentes numa só transação
```

## Princípios

1. **O navegador nunca manda preço, frete nem total.** Só produto, quantidade, escolhas e endereço (`app/src/domain/formularioPedido.ts`). O servidor recalcula com o cardápio do banco (`app/src/domain/pedido.ts`).
2. **Só o servidor cria pedido.** A função `criar_pedido` tem `execute` revogado para visitantes e usuários logados; só a `service_role` (que fica nas variáveis do Netlify, nunca no navegador) a executa.
3. **Tudo ou nada.** `criar_pedido` roda numa transação: se qualquer parte falhar (produto inexistente, total que não fecha, componente de outro pedido), nada é gravado.
4. **Status e pagamento vêm do banco.** O pedido nasce sempre `aguardando_pagamento` / `pendente` e no canal `proprio`, seja o que for que o payload diga.
5. **Última barreira no banco:** a soma dos itens precisa ser igual ao subtotal, e o total precisa fechar (`check` da tabela).

## Acompanhamento sem login

Cada pedido tem um `token_acompanhamento` (UUID aleatório). O cliente acompanha em `/acompanhar/<token>` (tarefa 3.10), chamando `acompanhar_pedido(token)`, que devolve **só** número, tipo, status, pagamento, total e data. Telefone e endereço nunca saem por aí. O visitante continua sem acesso direto à tabela `pedidos`.

## Anti-spam (3.11)

- **No banco:** no máximo 3 pedidos aguardando pagamento por telefone em 15 minutos (erro `limite_pedidos_pendentes`).
- **Na função do servidor:** limite por origem e tamanho máximo do corpo (PR seguinte).

## Erros que o banco devolve

| Mensagem | Significa |
| --- | --- |
| `pedido_invalido` | Payload sem pedido ou sem itens |
| `limite_pedidos_pendentes` | Muitos pedidos pendentes desse telefone |
| `componente_fora_do_pedido` | Componente ligado a item de outro pedido |
| `totais_inconsistentes` | Itens não somam o subtotal |
