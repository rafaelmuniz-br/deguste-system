# Como atender um pedido de dados pessoais (LGPD)

Quando um cliente pedir **acesso aos seus dados** ou **exclusão dos seus dados**, quem atende segue este roteiro. É para o Lucas ou o Bruno; não precisa programar.

> O texto público está na Política de Privacidade (`/privacidade`). O canal para receber o pedido ainda precisa ser definido (pendência **P11** do plano). Este roteiro vale assim que ele existir.

## 1. Receber e conferir quem é

1. Anote **quando** o pedido chegou e **o que** a pessoa quer (acesso ou exclusão). Guarde esse registro **fora do repositório** (uma planilha privada). O repositório é público.
2. Confirme que quem pede é a dona ou o dono dos dados. O jeito mais simples: a resposta precisa vir **do mesmo WhatsApp** usado nos pedidos, ou a pessoa confirma detalhes do último pedido (data e itens). Sem essa confirmação, **não entregue nem apague nada**: outra pessoa poderia estar tentando se passar por ela.
3. Descubra o telefone **só com dígitos e DDD** que a pessoa usa nos pedidos (ex.: `71999991234`).

## 2. Acesso e portabilidade (o que temos sobre a pessoa)

No Supabase → **SQL Editor**, do projeto certo (`deguste-prod` quando existir), rode trocando o telefone:

```sql
select public.exportar_dados_cliente('71999991234');
```

O resultado é um JSON com o cadastro, todos os pedidos (com itens e endereço) e o saldo de cashback. Copie, salve num arquivo `.json` e envie à pessoa **pelo mesmo canal seguro** em que ela pediu. Não cole esse conteúdo em grupo, em rede social ou no repositório.

## 3. Exclusão (anonimização)

```sql
select * from public.anonimizar_cliente('71999991234');
```

O que isso faz:

| Fica | Some |
| --- | --- |
| Os pedidos, com valores, itens e data (histórico de vendas e obrigações fiscais) | Nome, telefone, rua, número, complemento, ponto de referência, coordenadas e observações |
| O bairro (sozinho não identifica ninguém; serve para relatório por região) | O cadastro do cliente e o saldo de cashback |

- Se aparecer o erro **`pedido_em_andamento`**, a pessoa ainda tem um pedido sendo atendido. Espere ele terminar (ou ser cancelado) e rode de novo.
- Se voltar `pedidos_anonimizados = 0` e `cliente_removido = false`, não há dados desse telefone (talvez o número esteja escrito de outro jeito).
- **Não dá para desfazer.** Confira o telefone antes de rodar.

## 4. Responder à pessoa

Avise que foi concluído, o que foi feito e que os pedidos ficaram **sem dados pessoais** por obrigação de guarda dos registros de venda. Anote a data no registro do passo 1.

**Prazo:** a LGPD manda responder rapidamente; para a declaração completa, o prazo legal é de até 15 dias (art. 19). *(Confirmar com quem faz a revisão jurídica.)*

## Detalhes técnicos

Funções `exportar_dados_cliente` e `anonimizar_cliente` em `supabase/migrations/20260918170000_lgpd_direitos_do_titular.sql`. Só executam quem administra o banco (SQL Editor) e o servidor (service role); visitantes e usuários logados não. Cobertas por testes em `supabase/tests/lgpd.test.ts`.
