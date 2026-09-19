# Páginas legais, rodapé e aviso de cookies (tarefa 3.12)

**Status: rascunho.** O texto descreve como o sistema **realmente funciona hoje**, mas **não foi revisado por um profissional jurídico**. Enquanto isso, todas as páginas mostram o aviso "Rascunho em revisão" e os trechos que dependem de decisão aparecem destacados em amarelo (`[a definir]` e `[revisar: ...]`).

## O que existe

| Onde | O quê |
| --- | --- |
| `/privacidade` | Política de Privacidade (LGPD): controlador, dados coletados, bases legais, compartilhamento, retenção, direitos, segurança, cookies |
| `/termos` | Termos de Uso |
| `/cancelamento` | Cancelamento e reembolso |
| `/faq` | Perguntas frequentes |
| Rodapé (todas as páginas do cliente) | Nome, CNPJ, endereço, WhatsApp, Instagram e links das 4 páginas |
| Aviso de cookies | Faixa no topo, informativa, com botão "Entendi" |

O painel `/admin` e a `/cozinha` **não** têm rodapé nem aviso.

## Onde editar

- **Dados do negócio e decisões pendentes:** `app/src/config/negocio.ts` (fonte única: muda ali, vale em todas as páginas).
- **Textos:** `app/src/pages/legal/` (`Privacidade.tsx`, `Termos.tsx`, `Cancelamento.tsx`, `Faq.tsx`).
- Ao mudar qualquer texto legal, atualize `LEGAL_ATUALIZADO_EM` em `negocio.ts`.

## O que falta decidir (por isso aparece "[a definir]")

| # | Pendência | Onde aparece | Quem decide |
| --- | --- | --- | --- |
| 1 | ~~**Razão social** exata (como no cartão CNPJ)~~ — resolvido: Bruno Oliveira Pessoa | Privacidade | Lucas |
| 2 | ~~**Canal para pedidos da LGPD** e **quem é o encarregado**~~ — resolvido: WhatsApp; encarregado Lucas Costa Pinto Neves | Privacidade, 3.13 | Lucas + Bruno |
| 3 | **Gateway de Pix** (Mercado Pago ou Pagar.me) | Privacidade, Termos, FAQ | Rafael + Lucas (tarefa 3.1) |
| 4 | ~~**Outras formas de pagamento** além do Pix?~~ — resolvido: também aceita dinheiro/cartão **na entrega**, direto com o entregador (sem passar por gateway do site). ⚠️ Ainda falta implementar a opção "pagar na entrega" no checkout (afeta a tarefa 3.3/3.7 — hoje o fluxo assume só Pix) | Termos, FAQ | Lucas |
| 5 | ~~**Prazo do reembolso** depois de aprovado~~ — resolvido: até 2 dias úteis | Cancelamento | Lucas |
| 6 | ~~**Prazo para avisar de problema** no pedido~~ — resolvido: no mesmo dia da entrega | Cancelamento | Lucas |
| 7 | ~~**Regras de cancelamento** propostas no rascunho~~ — aprovadas como estavam | Cancelamento | Lucas |
| 8 | ~~**Cliente ausente na entrega**~~ — aprovado como estava no rascunho | Termos | Lucas |
| 9 | **Prazo de retenção** dos dados dos pedidos | Privacidade | Lucas + contador |
| 10 | **Serviço de mapas/rotas** que receberá o endereço | Privacidade | Rafael (tarefa 3.5) |
| 11 | **Revisão jurídica**: direito de arrependimento (art. 49 do CDC) para alimento preparado na hora; transferência internacional de dados; texto final dos termos | Cancelamento, Termos, Privacidade | Profissional jurídico |

Itens 1, 2, 4 (texto), 5, 6, 7 e 8 resolvidos por Lucas em 19/09/2026 — decisões de política simples, sem precisar esperar o Bruno confirmar por escrito (avisar ele mesmo assim). Restam: gateway Pix (3.1), serviço de mapas (3.5), prazo de retenção (com o contador) e a revisão jurídica final — nenhum bloqueia o resto do sistema.

## Como publicar

1. Resolver as pendências acima e preencher os valores em `negocio.ts`.
2. Fazer revisar por um profissional jurídico (ou, no mínimo, por quem responde legalmente pela loja).
3. Trocar `CONTEUDO_LEGAL_REVISADO` para `true` em `negocio.ts` e atualizar `LEGAL_ATUALIZADO_EM`.
   - Há um teste que **falha** se a chave estiver `true` e ainda sobrar qualquer `[a definir]` ou `[revisar: ...]` na tela. Ele existe para ninguém publicar com pendência por engano.
4. Abrir o PR com `Fecha: 3.12`.

## Regra dos cookies (importante para o futuro)

Hoje o site guarda no navegador **só a sacola** (armazenamento essencial) e o registro de que o aviso foi visto. **Não há cookies**, e um teste garante isso. Por isso o aviso é **informativo**: não há o que aceitar ou recusar.

**Se um dia entrar** Google Analytics, pixel do Instagram/Meta, chat, mapas incorporados ou qualquer coisa que grave cookie ou dado não essencial:
1. O aviso precisa virar **pedido de consentimento**, com botões "Aceitar" e "Recusar" de mesmo destaque.
2. **Nada** disso pode ser gravado antes do aceite.
3. A Política de Privacidade (seção 8) precisa listar o que é usado.
4. Avise o time antes: isso é uma mudança de projeto, não de tela.
