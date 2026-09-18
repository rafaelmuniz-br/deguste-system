import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { declaraNenhumaTarefa, lerTarefas, tarefasFechadasNoPr, validarPlano, verificarPr } from './plano.mjs'

const plano = (linhas) => ['## Fase 1 — Teste', ...linhas].join('\n')

describe('lerTarefas', () => {
  it('lê status, responsáveis e dependências; ignora notas indentadas e blocos de código', () => {
    const md = plano([
      '- [x] 1.1 Primeira `👤 Rafael`',
      '  - nota que não é tarefa',
      '- [ ] 1.2 Segunda `👤 Lucas + Bruno` `⏳ depende: 1.1`',
      '```',
      '- [ ] 1.9 dentro de código `👤 Rafael`',
      '```',
    ])
    const t = lerTarefas(md)
    assert.equal(t.length, 2)
    assert.deepEqual(t[0], { id: '1.1', prefixoFase: 1, fase: 1, feito: true, donos: ['Rafael'], deps: [], texto: 'Primeira' })
    assert.deepEqual(t[1].donos, ['Lucas', 'Bruno'])
    assert.deepEqual(t[1].deps, ['1.1'])
  })

  it('ignora checklists fora das seções de fase', () => {
    const md = '## 5. Definição de "pronto"\n- [ ] CI verde\n## Fase 2 — X\n- [ ] 2.1 A `👤 Rafael`'
    assert.equal(lerTarefas(md).length, 1)
  })
})

describe('validarPlano', () => {
  it('aceita um plano consistente', () => {
    const t = lerTarefas(plano(['- [ ] 1.1 A `👤 Rafael`', '- [ ] 1.2 B `👤 Lucas` `⏳ depende: 1.1`']))
    assert.deepEqual(validarPlano(t), [])
  })

  it('acusa tarefa sem responsável, responsável desconhecido e id duplicado', () => {
    const t = lerTarefas(plano(['- [ ] 1.1 A', '- [ ] 1.2 B `👤 Fulano`', '- [ ] 1.2 C `👤 Rafael`']))
    const erros = validarPlano(t).join('\n')
    assert.match(erros, /1\.1 não tem responsável/)
    assert.match(erros, /"Fulano" desconhecido/)
    assert.match(erros, /1\.2 aparece duas vezes/)
  })

  it('acusa dependência inexistente, circular consigo mesma e número de fase errado', () => {
    const t = lerTarefas(plano(['- [ ] 1.1 A `👤 Rafael` `⏳ depende: 9.9`', '- [ ] 1.2 B `👤 Rafael` `⏳ depende: 1.2`', '- [ ] 2.1 C `👤 Rafael`']))
    const erros = validarPlano(t).join('\n')
    assert.match(erros, /depende de 9\.9, que não existe/)
    assert.match(erros, /1\.2 depende de si mesma/)
    assert.match(erros, /2\.1 está na Fase 1/)
  })
})

describe('tarefasFechadasNoPr', () => {
  it('entende várias formas de escrever', () => {
    assert.deepEqual(tarefasFechadasNoPr('Fecha: 1.8'), ['1.8'])
    assert.deepEqual(tarefasFechadasNoPr('fecha 1.8 e 2.3'), ['1.8', '2.3'])
    assert.deepEqual(tarefasFechadasNoPr('Fecha: 1.8, 2.3 & 3.10'), ['1.8', '2.3', '3.10'])
    assert.deepEqual(tarefasFechadasNoPr('Fecha 1.8\nFecha 1.8'), ['1.8'])
  })

  it('ignora o exemplo dentro de comentário HTML do template', () => {
    assert.deepEqual(tarefasFechadasNoPr('<!-- Escreva "Fecha: 1.8" -->\nFecha: nenhuma'), [])
  })

  it('reconhece "Fecha: nenhuma"', () => {
    assert.equal(declaraNenhumaTarefa('Fecha: nenhuma'), true)
    assert.equal(declaraNenhumaTarefa('<!-- Fecha: nenhuma -->'), false)
  })
})

describe('verificarPr', () => {
  const t = lerTarefas(plano(['- [x] 1.1 Feita `👤 Rafael`', '- [ ] 1.2 Aberta `👤 Lucas`']))

  it('passa quando a tarefa fechada está marcada no plano', () => {
    assert.deepEqual(verificarPr(t, 'Fecha: 1.1'), { erros: [], avisos: [] })
  })

  it('falha quando o PR diz fechar uma tarefa que o plano ainda não marca', () => {
    const r = verificarPr(t, 'Fecha: 1.2')
    assert.equal(r.erros.length, 1)
    assert.match(r.erros[0], /1\.2.*não marca \[x\]/)
  })

  it('falha para tarefa que não existe', () => {
    assert.match(verificarPr(t, 'Fecha: 7.7').erros[0], /não existe/)
  })

  it('só avisa (não falha) quando o PR não diz o que fecha', () => {
    const r = verificarPr(t, 'corrige um texto')
    assert.deepEqual(r.erros, [])
    assert.equal(r.avisos.length, 1)
    assert.deepEqual(verificarPr(t, 'Fecha: nenhuma').avisos, [])
  })
})

describe('plano real do projeto', () => {
  it('está consistente (painel e controle dependem disso)', () => {
    const md = readFileSync(fileURLToPath(new URL('../PLANO-DE-PRODUCAO.md', import.meta.url)), 'utf8')
    const tarefas = lerTarefas(md)
    assert.ok(tarefas.length > 80)
    assert.deepEqual(validarPlano(tarefas), [])
  })
})
