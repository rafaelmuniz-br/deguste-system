# Manter o banco ativo (Supabase grátis)

No plano gratuito, o Supabase **pausa o projeto depois de cerca de 1 semana sem atividade** (confirmar a regra vigente no painel; ela já mudou antes). A loja fecha segunda e terça, mas **feriado prolongado, férias ou uma semana parada** poderiam passar do limite, e o site ficaria fora do ar na reabertura.

## O que já está no repositório

`.github/workflows/manter-banco-ativo.yml`: uma tarefa agendada do GitHub que, **todo dia às 06:17 (Bahia)**, faz uma consulta de leitura pública ao banco (a mesma que o cardápio faz). Se o banco não responder, a tarefa **falha e o GitHub avisa por e-mail** quem tem o repositório: é também um alarme de "banco fora do ar".

## O que você precisa fazer (uma vez, ~2 minutos)

No GitHub: repositório → **Settings → Secrets and variables → Actions → aba Variables → New repository variable**:

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | o endereço do projeto (o mesmo `VITE_SUPABASE_URL`) |
| `SUPABASE_ANON_KEY` | a chave **anon pública** (a mesma `VITE_SUPABASE_ANON_KEY`) |

Não são segredos (já vão para o navegador do cliente). **Nunca** coloque aqui a chave `service_role`.

Depois: aba **Actions → manter-banco-ativo → Run workflow** para testar. Deve terminar em verde com "Supabase respondeu HTTP 200".

Quando existir o projeto de **produção** (`deguste-prod`, tarefa 0.7), troque as duas variáveis pelas de produção (é o que precisa ficar acordado). O de desenvolvimento pode pausar sem problema.

## Se o projeto pausar mesmo assim

Painel do Supabase → **Restore project** (alguns minutos). Ver [`runbook.md`](runbook.md), item 9.

## Alternativa (se mudar de ideia)

Plano Pro do Supabase (não pausa e tem backup diário): custo mensal; hoje o projeto é feito para custo fixo zero.
