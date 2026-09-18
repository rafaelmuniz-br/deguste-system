# Agente de impressão da cozinha

Programa que roda no computador da cozinha, olha a fila de pedidos pagos e **imprime o recibo**. Só avisa o sistema de que "imprimiu" depois que a impressora aceitou. Se algo falhar, tenta de novo e, se não conseguir, o pedido aparece como problema para uma pessoa resolver. Como a fila funciona: [`docs/impressao.md`](../docs/impressao.md).

## O que você precisa

- Um computador **ligado durante o funcionamento** (o mesmo da cozinha), com internet.
- [Node.js](https://nodejs.org) 22 ou mais novo.
- A impressora térmica (USB compartilhada no Windows **ou** de rede) e o papel (80 mm ou 58 mm).
- Uma **conta do agente** no Supabase (`docs/impressao.md` explica como criar; quem administra o Supabase faz).

## 1. Instalar (uma vez)

```bash
cd printer-agent
npm install
copy .env.example .env
```

Abra o arquivo `.env` e preencha (o arquivo tem comentários explicando cada linha). **O `.env` tem a senha do agente: nunca envie para o Git nem para o grupo.**

## 2. Testar a impressora (sem precisar de pedido)

```bash
npm run teste
```

Imprime um recibo de exemplo. Confira no papel:

- Os **acentos** saem certos ("Conceição", "Guaraná")? Se aparecerem símbolos estranhos, coloque `IMPRESSORA_ACENTOS=ascii` no `.env` (imprime sem acentos, funciona em qualquer impressora).
- O papel está **na largura certa**? Nada cortado nas laterais? (`IMPRESSORA_LARGURA=48` para 80 mm ou `32` para 58 mm.)
- O **número do pedido** está grande e legível, e a guilhotina **corta** no fim?

### Qual `IMPRESSORA_TIPO` usar?

| Situação | Use | Detalhe |
| --- | --- | --- |
| Só quer ver o layout, sem impressora | `arquivo` | Grava em `recibos-teste.bin` |
| Impressora **USB** ligada ao Windows | `windows` | Compartilhe a impressora (Painel de Controle → Impressoras → botão direito → Propriedades → Compartilhamento) com um nome **sem espaços**, ex. `COZINHA`, e coloque em `IMPRESSORA_NOME` |
| Impressora **de rede / Wi-Fi** | `rede` | Coloque o IP em `IMPRESSORA_HOST` (a porta padrão é 9100). Dica: fixe o IP da impressora no roteador |

## 3. Ligar de verdade

```bash
npm start
```

Deve aparecer "Agente de impressão ligado". Faça um pedido de teste e veja sair o recibo.

## 4. Iniciar com o Windows e reiniciar se travar

1. Aperte `Win + R`, digite `shell:startup` e Enter (abre a pasta "Inicializar").
2. Crie ali um **atalho** para `printer-agent\iniciar-agente.bat`.
3. Reinicie o computador e confira se a janela do agente abriu sozinha.

O `.bat` religa o agente 5 segundos depois se ele fechar ou travar. **Não feche a janela do agente** durante o expediente (pode minimizar).

## Se algo der errado

| Sintoma | O que fazer |
| --- | --- |
| "Sem conexão com o sistema" | Internet do computador caiu. O agente continua tentando e avisa quando voltar. Os pedidos **não se perdem**: saem quando a conexão voltar. |
| "NÃO imprimiu (impressora de rede: ...)" | Impressora desligada, sem papel ou IP errado. Confira e o agente tenta de novo sozinho (espera 10 s, 20 s, 40 s...). |
| "IMPRESSO, mas NÃO consegui confirmar" | Saiu o papel, mas a internet falhou na confirmação. **Pode sair uma segunda via**: descarte uma. Não perde pedido. |
| Pedido aparece como falhou no painel | Passou de 5 tentativas. Resolva o problema da impressora e mande **reimprimir** (painel da cozinha). |
| "login do agente falhou" | E-mail ou senha do agente errados no `.env`, ou a conta foi removida. |

## Para quem programa

```bash
npm test     # 43 testes, sem dependências e sem impressora
```

Código em `src/`: `recibo.js` (layout), `escpos.js` (comandos da impressora), `transportes.js` (como chega à impressora), `agente.js` (o laço), `api.js` (fala com o Supabase).
