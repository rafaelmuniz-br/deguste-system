# Pagamento por Pix

> Estado: **banco pronto e testado** (esta página). A ligação com o gateway e a tela do Pix vêm nas próximas etapas; o gateway ainda não foi escolhido (tarefa 3.1), então o desenho é **independente de gateway**.

## Como o pagamento funciona

```
Cliente confirma o pedido ─► pedido nasce "aguardando pagamento" (servidor, criar_pedido)
        │
        ▼
Servidor pede a cobrança Pix ao gateway ─► registrar_cobranca_pix (guarda o "copia e cola" e o prazo)
        │
        ▼
Cliente paga no app do banco ─► gateway avisa o servidor (webhook)
        │
        ▼
Servidor CONFIRMA com o gateway ─► confirmar_pagamento_pix ─► pedido vira "pago/novo" ─► cozinha + impressora
```

Quem decide se o pedido está pago é **o banco**, nunca o navegador nem o "aviso" do gateway sozinho.

## Regras (todas testadas em `supabase/tests/pagamento-pix.test.ts`)

| Situação | O que acontece |
| --- | --- |
| Aviso de pagamento repetido (o gateway repete, é normal) | **Nada muda**: mesma data de pagamento, mesmo status, uma impressão só |
| Valor pago **diferente** do total do pedido (a mais ou a menos) | **Não confirma**; vai para a lista `pagamentos_para_revisar` |
| Pix pago **depois** que o pedido expirou ou foi cancelado | O dinheiro é registrado como pago, mas o pedido **não vai para a cozinha nem para a impressora**; entra em `pagamentos_para_revisar` (motivo `pago_apos_cancelamento`) para alguém **estornar** |
| Aviso de uma cobrança que não conhecemos | Ignorado (`desconhecido`) |
| Pedido que ninguém pagou | Expira: cancelado com motivo "Pagamento não realizado a tempo" (prazo do Pix + 2 min de folga; se o Pix nem foi gerado, 30 min desde o pedido) |
| Pedido expirado | Deixa de contar no limite anti-spam do telefone (3 pedidos pendentes por 15 min) |

## Peças no banco (migration `20260918220000_pagamento_pix.sql`)

- Colunas novas em `pedidos`: `pix_copia_cola`, `pagamento_expira_em`.
- Tabela `pagamentos_para_revisar` (só admin lê; nunca apagar: é trilha de auditoria).
- Funções **só do servidor** (`service_role`; o navegador e até o admin recebem "permission denied"): `registrar_cobranca_pix`, `confirmar_pagamento_pix`, `expirar_pedidos_pendentes`.
- `acompanhar_pedido` agora devolve também o Pix e o prazo, **só enquanto o pedido pode ser pago** (depois de pago o código some).
- O gatilho da fila de impressão ignora pedido cancelado, mesmo com pagamento tardio.

## Decisões que valem confirmar com o Bruno/Lucas

1. **Pagamento tardio é estornado, não aceito.** Alternativa: aceitar o pedido tardio se ainda houver como fazer. Escolhi estornar por segurança (o cliente já pode ter desistido e o preço pode ter mudado).
2. **Prazo do Pix:** 30 minutos (ajustável na chamada da expiração).
3. Quem faz o **estorno**: no painel do gateway, manualmente (o volume esperado é baixo). A tela de "pagamentos para revisar" no admin é uma melhoria futura.

## Ainda falta

- Ligação com o gateway (criar cobrança e receber o webhook) e a tela do Pix no acompanhamento (3.8, 3.9).
- Escolha do gateway e conta com CNPJ (3.1, 3.2) e teste no sandbox.
- Aplicar a migration `20260918220000` no banco de dev (1.14).
