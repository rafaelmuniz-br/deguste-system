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

## A função do servidor (`/.netlify/functions/pedidos`)

Código em `app/src/server/` (testado); o arquivo `app/netlify/functions/pedidos.ts` só liga as peças. `POST` com `{ "acao": "calcular" | "confirmar", "pedido": {...} }`.

| Ação | O que faz | Resposta de sucesso |
| --- | --- | --- |
| `calcular` | Valida, recalcula preço e frete, **não grava** | `{ ok: true, pedido }` |
| `confirmar` | Recalcula de novo e chama `criar_pedido` | `{ ok: true, pedido, numero, token }` |

| Status | Quando |
| --- | --- |
| 200 | Sucesso |
| 400 | Formato inválido (JSON quebrado, campo ausente, ação desconhecida) |
| 413 | Corpo maior que 20 KB |
| 422 | Regra de negócio (loja fechada, item esgotado, fora da área, pedido mínimo...) |
| 429 | Muitas requisições do mesmo IP, ou muitos pedidos pendentes do mesmo telefone |
| 503 / 500 | Servidor sem configuração ou falha ao gravar. A resposta nunca traz detalhe interno |

**Variáveis de ambiente** (Netlify → Site settings → Environment variables; **nunca** no Git):

| Variável | Para quê | Obrigatória |
| --- | --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave **secreta** do servidor (executa `criar_pedido`) | Sim |
| `ORS_API_KEY` | OpenRouteService, para frete por distância | Só se a regra de frete for por km/faixas |

A regra de frete "por bairro" não precisa do `ORS_API_KEY`.

## Acompanhamento sem login

Cada pedido tem um `token_acompanhamento` (UUID aleatório). Ao confirmar o pedido, o cliente recebe o link `/acompanhar/<token>` (tarefa 3.10). A página chama `acompanhar_pedido(token)` a cada 10 s enquanto a aba está aberta (pausa em segundo plano, atualiza ao voltar, e para quando o pedido termina). Um token que nem parece um UUID nunca chega ao banco. A função que devolve **só** número, tipo, status, pagamento, total e data. Telefone e endereço nunca saem por aí. O visitante continua sem acesso direto à tabela `pedidos`.

## Anti-spam (3.11)

- **No banco:** no máximo 3 pedidos aguardando pagamento por telefone em 15 minutos (erro `limite_pedidos_pendentes`).
- **Na função do servidor:** 6 confirmações e 30 cálculos por minuto por IP (por instância, best-effort) e corpo de no máximo 20 KB.

## Erros que o banco devolve

| Mensagem | Significa |
| --- | --- |
| `pedido_invalido` | Payload sem pedido ou sem itens |
| `limite_pedidos_pendentes` | Muitos pedidos pendentes desse telefone |
| `componente_fora_do_pedido` | Componente ligado a item de outro pedido |
| `totais_inconsistentes` | Itens não somam o subtotal |

## Modo simulado (só desenvolvimento)

Sem a função do servidor e sem cozinha, `VITE_USAR_API_SIMULADA=true` (em `app/.env.local`) faz o checkout usar uma API simulada no navegador, e o acompanhamento avança sozinho a cada 15 s (pagamento → fila → preparo → pronto → concluído), para dar para ver a linha do tempo funcionando. Isso **só existe em desenvolvimento**: no build de produção `import.meta.env.DEV` é falso e a API real é sempre usada.
