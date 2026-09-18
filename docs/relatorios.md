# Relatórios de vendas

Tela em **`/admin/relatorios`** (só administradores). Escolha o período (Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Este mês, ou de/até uma data) e veja:

| Bloco | O que mostra |
| --- | --- |
| **Resumo** | Pedidos, faturamento, ticket médio (faturamento ÷ pedidos) e cancelados |
| **Por dia** | Pedidos e faturamento de cada dia, com barrinha de proporção |
| **Horário de pico** | Pedidos por hora do dia (para escalar a cozinha) |
| **Por canal e tipo** | Site próprio / iFood / 99Food e Entrega / Retirada |
| **Produtos mais vendidos** | Unidades por produto, quantas foram dentro de combos e o faturamento do que foi vendido avulso |

## Regras dos números (para todos batermos)

- **Venda** = pedido **pago e não cancelado**. Pedido aguardando pagamento ou cancelado não entra no faturamento; os cancelados aparecem só como contagem.
- **Datas e horas de Salvador** (America/Bahia): um pedido às 22h30 de quinta conta na quinta, mesmo que já seja sexta em UTC.
- **Produtos pelo produto real** (decisão D3 do plano): o hambúrguer escolhido dentro de um combo soma com o mesmo hambúrguer vendido avulso. Ex.: Smash avulso (2) + Smash escolhido em 1 combo = **3 unidades de Smash**, sendo 1 "em combo". O próprio combo também aparece como produto.
- **Faturamento por produto só do avulso.** O preço de um combo é um valor fechado; dividir por produto seria inventar número. Por isso a coluna se chama "Faturamento avulso" e mostra "—" quando o produto só foi vendido em combos.
- Período máximo: 1 ano.

## Por dentro (Rafael)

- Toda a conta é feita **no banco**, numa função só: `relatorio_vendas(inicio, fim)` (migration `20260918210000`), que devolve JSON. É `security invoker`: o RLS continua valendo (só admin lê pedidos) e há checagem explícita com mensagem clara.
- Testada com pedidos de verdade em `supabase/tests/relatorios.test.ts`: cancelado/pendente/fora do período não contam, fuso da Bahia na virada do dia, combo multiplicado pela quantidade, permissões.
- Tela: `app/src/pages/admin/Relatorios.tsx`; regras de período e formatação em `app/src/domain/relatorios.ts`. Resposta atrasada de um período antigo é descartada (não sobrescreve o atual).

## Ainda falta

- Exportar para planilha (CSV) e comparação com o período anterior.
- Aplicar a migration `20260918210000` no banco de dev (1.14).
- Pedidos de iFood/99Food só aparecerão quando a Fase 7 criar esses pedidos (o campo `canal` já está pronto).
