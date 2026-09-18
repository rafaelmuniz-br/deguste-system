// Leitura e validação do PLANO-DE-PRODUCAO.md. Sem dependências (roda com `node`).
// Mesmo formato lido pelo painel local (painel/index.html):
//   - [ ] 1.8 Texto da tarefa `👤 Lucas + Bruno` `⏳ depende: 1.7`

export const PESSOAS = ['Rafael', 'Lucas', 'Bruno']

/** Lê as tarefas numeradas que ficam dentro das seções "## Fase N — ...". */
export function lerTarefas(md) {
  const tarefas = []
  let fase = null
  let cerca = false
  for (const linha of md.split('\n')) {
    if (linha.startsWith('```')) cerca = !cerca
    if (cerca) continue
    if (linha.startsWith('## ')) {
      const m = linha.match(/^## Fase (\d+) /)
      fase = m ? Number(m[1]) : null
      continue
    }
    const m = linha.match(/^- \[([ xX])\] (\d+)\.(\d+) (.*)$/)
    if (!m || fase === null) continue
    const dono = m[4].match(/`👤 ([^`]+)`/)
    const dep = m[4].match(/`⏳ depende: ([^`]+)`/)
    tarefas.push({
      id: `${m[2]}.${m[3]}`,
      prefixoFase: Number(m[2]),
      fase,
      feito: m[1] !== ' ',
      donos: dono ? dono[1].split(' + ').map((s) => s.trim()) : [],
      deps: dep ? dep[1].split(',').map((s) => s.trim()) : [],
      texto: m[4].replace(/\s*`(?:👤|⏳)[^`]*`/g, ''),
    })
  }
  return tarefas
}

/** Problemas de formato/consistência que quebrariam o painel ou o controle. */
export function validarPlano(tarefas) {
  const erros = []
  const ids = new Set()
  for (const t of tarefas) {
    if (ids.has(t.id)) erros.push(`Tarefa ${t.id} aparece duas vezes.`)
    ids.add(t.id)
  }
  for (const t of tarefas) {
    if (t.prefixoFase !== t.fase) {
      erros.push(`Tarefa ${t.id} está na Fase ${t.fase}; o número deveria começar com ${t.fase}.`)
    }
    if (t.donos.length === 0) {
      erros.push(`Tarefa ${t.id} não tem responsável (falta \`👤 Nome\`).`)
    }
    for (const d of t.donos) {
      if (!PESSOAS.includes(d)) {
        erros.push(`Tarefa ${t.id}: responsável "${d}" desconhecido (use ${PESSOAS.join(', ')}).`)
      }
    }
    for (const dep of t.deps) {
      if (dep === t.id) erros.push(`Tarefa ${t.id} depende de si mesma.`)
      else if (!ids.has(dep)) erros.push(`Tarefa ${t.id} depende de ${dep}, que não existe.`)
    }
  }
  return erros
}

/** Tarefas que o corpo do PR diz fechar: "Fecha: 1.8", "Fecha 1.8 e 2.3", "fecha: 1.8, 2.3". */
export function tarefasFechadasNoPr(corpo) {
  const semComentarios = (corpo ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const ids = new Set()
  for (const m of semComentarios.matchAll(/\bfecha(?:m)?\s*:?\s*((?:\d+\.\d+)(?:\s*(?:,|e|&)\s*\d+\.\d+)*)/gi)) {
    for (const id of m[1].match(/\d+\.\d+/g)) ids.add(id)
  }
  return [...ids]
}

export function declaraNenhumaTarefa(corpo) {
  const semComentarios = (corpo ?? '').replace(/<!--[\s\S]*?-->/g, '')
  return /\bfecha\s*:?\s*nenhuma\b/i.test(semComentarios)
}

/**
 * O PR diz que fecha a tarefa X? Então o plano, na versão deste PR, precisa marcar X como [x].
 * Devolve { erros, avisos }.
 */
export function verificarPr(tarefas, corpo) {
  const erros = []
  const avisos = []
  const porId = new Map(tarefas.map((t) => [t.id, t]))
  const fechadas = tarefasFechadasNoPr(corpo)

  for (const id of fechadas) {
    const t = porId.get(id)
    if (!t) erros.push(`O PR diz que fecha ${id}, mas essa tarefa não existe no plano.`)
    else if (!t.feito) {
      erros.push(`O PR diz que fecha ${id}, mas o plano ainda não marca [x] nessa tarefa. Marque no mesmo PR.`)
    }
  }
  if (fechadas.length === 0 && !declaraNenhumaTarefa(corpo)) {
    avisos.push('O PR não diz quais tarefas do plano fecha. Escreva "Fecha: 1.8" (ou "Fecha: nenhuma").')
  }
  return { erros, avisos }
}
