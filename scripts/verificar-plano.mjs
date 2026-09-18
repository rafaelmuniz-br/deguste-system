// Verifica o plano de produção. Uso:
//   node scripts/verificar-plano.mjs                  (só valida formato e dependências)
//   PR_BODY="..." node scripts/verificar-plano.mjs    (no CI de PR: confere também o "Fecha: X.Y")
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lerTarefas, validarPlano, verificarPr } from './plano.mjs'

const arquivo = fileURLToPath(new URL('../PLANO-DE-PRODUCAO.md', import.meta.url))
const tarefas = lerTarefas(readFileSync(arquivo, 'utf8'))

const erros = validarPlano(tarefas)
const avisos = []

if (process.env.GITHUB_EVENT_NAME === 'pull_request' || process.env.PR_BODY) {
  const r = verificarPr(tarefas, process.env.PR_BODY ?? '')
  erros.push(...r.erros)
  avisos.push(...r.avisos)
}

const feitas = tarefas.filter((t) => t.feito).length
console.log(`Plano: ${tarefas.length} tarefas, ${feitas} concluídas.`)
for (const a of avisos) console.log(`::warning::${a}`)
for (const e of erros) console.log(`::error::${e}`)
if (erros.length > 0) {
  console.error(`\n${erros.length} problema(s) no plano de produção.`)
  process.exit(1)
}
console.log('Plano OK.')
