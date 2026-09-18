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

## O que falta

- O **agente** que roda no PC da cozinha e fala com a impressora (tarefa 4.7), e o modelo da impressora (pendência **P2**).
- O layout do recibo aprovado pelo Bruno (4.8).
- Aviso na tela da cozinha quando houver problema de impressão (4.4, 4.9) e o botão de reimprimir (4.10).
