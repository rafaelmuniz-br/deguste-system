# Pagamento por Pix

> Estado: **banco, servidor e tela do Pix prontos e testados**; falta só o teste no **sandbox real** do gateway. O gateway ainda não foi escolhido (tarefa 3.1), então o desenho é **independente de gateway**: existe um adaptador do Mercado Pago (candidato, escrito pela documentação e testado com respostas simuladas) e trocar por Pagar.me é escrever outro adaptador.

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
3. Quem faz o **estorno**: no painel do gateway, manualmente (o volume esperado é baixo). O aviso aparece **no painel da cozinha** (faixa "pagamentos precisam de conferência"), com o botão **Já resolvi** para dar baixa depois de estornar.

## Servidor (Netlify Functions)

| Function | Quem chama | O que faz |
| --- | --- | --- |
| `gerar-pix` | O site (página do pedido), com o **token** do pedido | Cria a cobrança no gateway com o **valor do banco** (nunca o do navegador) e guarda o "copia e cola". Pedir de novo devolve a mesma cobrança (não cobra em dobro). |
| `webhook-pix` | O gateway | Confere a **assinatura**; **consulta o gateway** para saber o que aconteceu de verdade; chama `confirmar_pagamento_pix`. Responde 200 para o que é repetição ou não interessa; **502** se algo falhou (o gateway tenta de novo, e o banco é idempotente). |
| `expirar-pedidos` | Agendador do Netlify, a cada 5 min | Cancela pedidos que ninguém pagou a tempo. |

Código: `app/src/server/pix/` (`gateway.ts` é o contrato; `mercadoPago.ts` é o adaptador; `pixHandlers.ts` são as duas funções; `dependenciasPix.ts` liga ao Supabase).

### Variáveis de ambiente (Netlify → Site configuration → Environment variables)

| Variável | Para quê | Secreta? |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Já usadas pela function de pedidos | **Sim** (a chave) |
| `MP_ACCESS_TOKEN` | Token de acesso do Mercado Pago (use o de **teste** no sandbox) | **Sim** |
| `MP_WEBHOOK_SECRET` | "Chave secreta" do webhook (Suas integrações → Webhooks) | **Sim** |
| `SITE_URL` | Endereço público do site, ex.: `https://deguste.netlify.app` (o gateway chama `SITE_URL/.netlify/functions/webhook-pix`) | Não |
| `PIX_EMAIL_PAGADOR` | E-mail da loja usado como "pagador" (a API exige um; não coletamos o e-mail do cliente) | Não |

Nada disso vai para o Git nem para o navegador (nenhuma começa com `VITE_`). Faltou variável → a function responde 502 sem vazar detalhe.

### Configurar o webhook no Mercado Pago (quando a conta existir, 3.2)

1. Suas integrações → sua aplicação → **Webhooks** → URL de produção/teste: `SITE_URL/.netlify/functions/webhook-pix`, evento **Pagamentos**.
2. Copiar a **chave secreta** gerada para `MP_WEBHOOK_SECRET`.
3. Fazer um Pix de teste no sandbox e conferir no log do Netlify: `webhook-pix` deve responder `confirmado`.

Pontos do adaptador marcados com `SANDBOX:` em `mercadoPago.ts` devem ser conferidos nessa primeira execução (formato de `point_of_interaction`, significado de `approved`).

## Tela do Pix (o que o cliente vê)

Na página do pedido (`/acompanhar/<token>`), enquanto o pedido aguarda pagamento, aparece o bloco **Pague com Pix**:

1. Passo a passo curto (abrir o app do banco → Pix → QR Code ou Copia e Cola).
2. **QR Code** desenhado no próprio navegador a partir do código (nenhum serviço externo recebe o código). Fundo branco e módulos pretos sempre, mesmo no modo escuro. Conferi com um leitor de QR de verdade (jsQR) que o QR desenhado decodifica exatamente o "copia e cola".
3. Campo **Pix Copia e Cola** + botão **Copiar código** (se o aparelho não deixar copiar sozinho, o texto fica selecionado e a tela explica).
4. "Você tem cerca de **N min** para pagar."
5. **Já paguei**: consulta o pedido na hora (a página já consulta sozinha a cada 10 s).
6. Quando o pagamento é confirmado, o bloco some e o andamento segue ("Pagamento confirmado! Seu pedido entrou na fila da cozinha.").
7. **Prazo vencido**: o QR sai da tela, aparece "Não pague este código" e o link para fazer novo pedido.
8. Se o servidor não conseguir gerar o Pix: "nada foi cobrado" e botão **Tentar de novo**.

Código: `app/src/components/PagamentoPix.tsx`, `app/src/domain/qr.ts` (biblioteca `qrcode-generator`, MIT, 5 kB, só na página do pedido), `app/src/data/pixApi.ts`. Em desenvolvimento (API simulada) o código é de mentira e diz "SIMULADO-NAO-PAGAR".

## Testes

- `app/src/server/pix/*.test.ts` (adaptador com HTTP simulado e assinatura real HMAC; as duas functions; a ligação com o Supabase).
- `supabase/tests/fluxo-pix.test.ts`: **de ponta a ponta com o banco de verdade** — pedido → Pix → pagamento → webhook; aviso repetido (até simultâneo); assinatura falsa; valor divergente; pagamento após expiração; pedido já pago.

## Ainda falta

- Escolha do gateway e conta com CNPJ (3.1, 3.2) e **teste no sandbox real** (a parte que os testes simulados não provam).
- Aplicar a migration `20260918220000` no banco de dev (1.14) e cadastrar as variáveis no Netlify (0.6).

