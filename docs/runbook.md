# Runbook: o que fazer quando algo dá errado

Para **Lucas**, **Bruno** e **Rafael**. Cada problema tem: como reconhecer, o que fazer **agora** (com o cliente esperando) e como investigar depois. Regra de ouro: **primeiro resolva o pedido do cliente, depois descubra a causa.**

> Se o sistema inteiro estiver fora do ar, use o [plano de contingência](contingencia.md) (WhatsApp manual) e volte aqui depois.

**Quem acionar** (preencher antes do go-live, tarefa 5.6):

| Assunto | Pessoa | Contato |
| --- | --- | --- |
| Cozinha, impressora, dia a dia | Lucas | _a preencher_ |
| Sistema fora do ar, erro de programação, banco | Rafael | _a preencher_ |
| Decisão do negócio (reembolso, fechar a loja) | Bruno | _a preencher_ |

---

## 1. O pedido não imprimiu

**Como reconhecer:** faixa vermelha no painel da cozinha ("N pedidos não saíram impressos"), ou o pedido aparece na tela e a impressora está parada.

**Agora (2 min):**
1. Olhe a impressora: ligada? Papel? Tampa fechada? Cabo/rede conectados?
2. No painel da cozinha, no cartão do pedido, toque em **Reimprimir**.
3. Não saiu? **Faça o pedido pela tela** (o painel mostra itens, escolhas e observações em destaque) e siga. O pedido não se perde: está no painel.

**Investigar depois:**
- O **agente de impressão** está rodando no PC da cozinha? (janela do agente aberta; se não, abrir `iniciar-agente.bat`.) Passo a passo em [`printer-agent/README.md`](../printer-agent/README.md), seção "Se algo der errado".
- O PC está com internet? O agente precisa dela.
- Tentativas esgotadas (5) viram `falhou`: depois de arrumar a causa, use **Reimprimir**.
- Detalhes do funcionamento da fila: [`impressao.md`](impressao.md).

## 2. O cliente diz que pediu e o pedido não chegou

**Agora:**
1. Peça o **número do pedido** ou o **link de acompanhamento** (`/acompanhar/...`) que ele recebeu. Abra o link: o status diz tudo.
   - **"Aguardando pagamento"**: ele não pagou (ou o Pix não confirmou; veja o item 3). Pix expirado = pedido cancelado.
   - **"Pago"/"Na fila"**: o pedido existe; procure no painel da cozinha pelo número.
   - **Link não abre / "não encontrado"**: não chegou a ser criado. Peça desculpas, refaça o pedido pelo WhatsApp ([contingência](contingencia.md)) e avise o Rafael.
2. Sem número nem link: procure no painel por **nome/telefone** (pedido pago aparece na cozinha).

**Investigar depois:** logs da function `pedidos` no Netlify (Functions → pedidos → Logs) na hora do pedido; se for erro 503, faltou variável de ambiente; 429 é limite anti-spam (3 pedidos pendentes por telefone em 15 min).

## 3. O cliente pagou o Pix e o pedido não confirmou

**Como reconhecer:** cliente mostra o comprovante; a página do pedido continua "Aguardando pagamento".

**Agora:**
1. Peça o link do pedido e toque em **Já paguei** na página (força a consulta). Espere 1 minuto.
2. Continua igual? **Abra o painel do gateway** (Mercado Pago/Pagar.me) e procure o pagamento pelo valor e horário:
   - **Aprovado no gateway:** o aviso (webhook) não chegou. Avise o **Rafael** (ele reenvia o aviso pelo painel do gateway, e o sistema é seguro contra repetição: não confirma em dobro). **Enquanto isso, faça o pedido** e anote o número no papel.
   - **Não aparece no gateway:** o cliente não pagou este código; peça para conferir o app do banco.
3. Cliente pagou **um valor diferente**: o painel da cozinha mostra "N pagamentos precisam de conferência". Não faça o pedido antes de conferir; veja o item 4.

**Investigar depois:** Netlify → Functions → `webhook-pix` → Logs. `assinatura inválida` = segredo do webhook errado (`MP_WEBHOOK_SECRET`); `falha ao processar` = gateway ou banco fora do ar (o gateway tenta de novo sozinho).

## 4. Pagamento para estornar ("precisam de conferência")

**Como reconhecer:** faixa no painel da cozinha: "o Pix de R$ X chegou depois do pedido ser cancelado ou expirar" ou "valor diferente do total".

**Fazer:**
1. Decida com o **Bruno**: dá para atender o cliente mesmo assim (refazer o pedido pelo WhatsApp e **não** estornar) ou devolve o dinheiro.
2. Para devolver: **painel do gateway → pagamento → Estornar**.
3. No painel da cozinha, toque em **Já resolvi** (dá baixa no aviso). Anote o motivo se quiser (o registro fica no banco).

## 5. O painel da cozinha não atualiza / mostra "Sem tempo real"

**Como reconhecer:** faixa vermelha "Sem tempo real: atualizando a cada 15 s".

**Fazer:** confira a internet do tablet/PC. O painel **continua funcionando**, só com atraso de até 15 s (consulta sozinho). Se a faixa "Não conseguimos atualizar os pedidos" aparecer, **os pedidos na tela podem estar desatualizados**: use o WhatsApp e o celular como apoio até voltar. Recarregar a página (F5) resolve a maioria dos casos.

## 6. O site abre "Não conseguimos carregar o cardápio"

1. Teste em outro aparelho/rede. Se só o seu falha, é a internet.
2. Se falha em todos: pode ser o **Supabase pausado** (item 9) ou fora do ar. Use a [contingência](contingencia.md) e avise o **Rafael**.

## 7. A loja aparece aberta/fechada errado

- **Fechar agora** (acabou tudo, imprevisto): Admin → **Loja** → "Fechada agora" → Salvar. Depois volte para "Seguir os horários".
- Aparece fechada em horário de funcionamento: confira em Admin → Loja se o modo está em "Seguir os horários" e se o dia tem horário cadastrado.

## 8. Cardápio errado (preço, produto que acabou, foto)

- **Acabou um produto:** Admin → Produtos → **Marcar esgotado** (um toque).
- **Preço errado:** Admin → Produtos → Editar. O preço vale para os **próximos** pedidos (pedidos já feitos guardam o preço da hora da compra).
- Cliente pagou um preço errado que estava no site: atenda como ele viu e corrija o cadastro depois.

## 9. O Supabase pausou (projeto grátis inativo)

**Como reconhecer:** site e painel não carregam dados; no painel do Supabase aparece "Project paused".

**Fazer:** entrar no painel do Supabase (conta do Lucas) → **Restore project**. Leva alguns minutos. Para **não acontecer de novo**, o repositório tem uma rotina que "acorda" o banco todo dia (`.github/workflows/manter-banco-ativo.yml`, veja [`manter-banco-ativo.md`](manter-banco-ativo.md)).

## 10. Erro "misterioso" para o Rafael investigar

- **Netlify** → Logs das functions (`pedidos`, `gerar-pix`, `webhook-pix`, `expirar-pedidos`).
- **Supabase** → Logs → API/Postgres.
- Reproduzir com o Supabase de **dev**, nunca em produção. Teste primeiro no papel de quem perguntou.

## 11. Cliente pede para apagar/ver os dados dele

Siga [`lgpd-direitos.md`](lgpd-direitos.md): confirmar quem é a pessoa, exportar ou anonimizar com as funções prontas, responder no prazo.

---

## Depois de qualquer incidente

Anote em uma issue no GitHub: **o que aconteceu, quanto tempo durou, quantos pedidos afetou, o que resolveu**. Se o mesmo incidente se repetir, vira tarefa no plano de produção.
