# Impressão do pedido na cozinha

Objetivo: **todo pedido pago sai impresso na cozinha, ou alguém é avisado de que não saiu.** Nada falha em silêncio.

```text
Pedido pago ──► fila (tabela impressoes) ──► Agente no PC da cozinha ──► Impressora térmica
                       ▲                            │
                       └──── confirma / avisa falha ┘
```

## Como a fila funciona (banco, já pronto e testado)

| Passo | O que acontece |
| --- | --- |
| Entrada | Quando o pedido passa a `pago`, um gatilho coloca ele na fila **uma vez só**. |
| Pegar | O agente chama `proxima_impressao()`: recebe o pedido completo (itens, escolhas, observações, endereço, valores) e uma **reserva de 90 s**. Ninguém mais pega o mesmo pedido. |
| Confirmar | Depois de imprimir, o agente chama `confirmar_impressao(id)`. Só então o pedido conta como **impresso**. |
| Falha | Se a impressora falhar, `registrar_falha_impressao(id, erro)`: tenta de novo com espera crescente (10 s, 20 s, 40 s, 80 s...), até 5 minutos. |
| Agente travou | Se o agente sumir sem responder, a reserva expira em 90 s e o pedido volta para a fila. |
| Esgotou | Na 5ª tentativa sem sucesso o pedido vira **`falhou`** e aparece em `impressoes_com_problema`. |
| Atraso | Pedido na fila há mais de **2 minutos** sem imprimir também aparece em `impressoes_com_problema`. |
| Reimprimir | `reimprimir_pedido(pedido_id)` (só admin) recoloca na fila, mesmo se já impresso ou falho. A via sai marcada como reimpressão. |

## Quem pode fazer o quê

- O **agente** entra com uma conta própria (e-mail e senha no Supabase) cadastrada em `agentes_impressao`. Ele **só consegue chamar as funções acima**: não lê pedidos, clientes nem a tabela da fila. **Não usa a `service_role`**, então se o PC da cozinha for comprometido, o estrago é limitado a imprimir.
- Admin (Bruno, Lucas) vê a fila e os problemas e pode reimprimir.
- Visitante e cliente logado não têm acesso.

## Criar a conta do agente (uma vez por ambiente; quem administra o Supabase)

1. **Authentication → Users → Add user**: e-mail próprio para isso (ex.: `cozinha@...`) e senha forte e única. Marque **Auto Confirm User**.
2. No **SQL Editor**:

```sql
insert into public.agentes_impressao (user_id)
select id from auth.users where email = 'EMAIL_DO_AGENTE';
```

A senha fica **só no computador da cozinha** (arquivo de configuração do agente, fora do Git).

## O agente (pasta `printer-agent/`)

Programa Node que roda no PC da cozinha e faz o laço: **pega o próximo pedido → imprime → só então confirma**. Instalação e uso: [`printer-agent/README.md`](../printer-agent/README.md).

- Imprime por **rede** (TCP 9100), por **impressora USB compartilhada do Windows** ou em **arquivo** (teste sem impressora). O modelo real da impressora ainda é a pendência **P2**: quando ela estiver em mãos, o "teste de impressão" (`npm run teste`) valida acentos, largura e corte.
- Se a impressora falhar, avisa o banco (que tenta de novo com espera crescente). Se a internet cair, continua tentando e avisa quando volta.
- Prefere sair uma **segunda via** a um pedido **não sair**: se imprimiu mas não conseguiu confirmar, a reserva expira e o pedido volta para a fila.
- Testado com um servidor de rede de verdade e com transportes simulados (43 testes). **Não foi testado em impressora física.**

### Exemplo do recibo (para o Bruno aprovar, tarefa 4.8)

Na impressora, o número do pedido, os itens, as observações e o TOTAL saem em letra **maior/negrito**.

```text
PEDIDO 123
>>> ENTREGA <<<
SITE PROPRIO  18/09, 18:44
------------------------------------------------
2x Combo 3 Smashs 90g
> Smashs: 4x Jackfino
> Smashs: 2x Xeque Mate
> Bebida: 2x Guarana Antarctica Lata
!! SEM CEBOLA

1x Batata frita

------------------------------------------------
OBSERVACAO DO PEDIDO:
TOCAR A CAMPAINHA 2 VEZES
------------------------------------------------
Maria da Conceicao
71999991234
Rua Jose Augusto Tourinho Dantas, 506 - Praia do
Flamengo
Compl.: apto 201
Ref.: portao azul
------------------------------------------------
Subtotal                                R$ 58,96
Entrega                                  R$ 9,80
TOTAL           R$ 68,76
PIX: PAGO
```

Perguntas para o Bruno: falta alguma informação? Sobra alguma? O que precisa de destaque maior na hora do preparo? (Reimpressões saem com `*** REIMPRESSAO ***` no topo.)

## O que falta

- O modelo da impressora (pendência **P2**) e um teste em impressora real.
- O layout do recibo aprovado pelo Bruno (4.8).
- Testar o aviso de "não saiu impresso" e o botão Reimprimir (já existem na tela da cozinha, ver [`cozinha.md`](cozinha.md)) com a impressora real (4.13).
