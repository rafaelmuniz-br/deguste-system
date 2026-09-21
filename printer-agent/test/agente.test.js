import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { criarAgente } from '../src/agente.js'
import { pedidoDeExemplo } from '../src/exemplo.js'

const JOB = { ...pedidoDeExemplo, impressao_id: 'job-1' }

function montar({ proximas = [JOB], enviar, confirmar, falha } = {}) {
  const chamadas = []
  const fila = [...proximas]
  const logs = { info: [], error: [] }
  const api = {
    async proxima() {
      chamadas.push('proxima')
      const item = fila.shift()
      if (item instanceof Error) throw item
      return item ?? null
    },
    async confirmar(id) {
      chamadas.push(`confirmar:${id}`)
      if (confirmar) return confirmar(id)
    },
    async falha(id, erro) {
      chamadas.push(`falha:${id}:${erro}`)
      if (falha) return falha(id, erro)
    },
  }
  const transporte = {
    nome: 'teste',
    async enviar(bytes) {
      chamadas.push('enviar')
      if (enviar) return enviar(bytes)
    },
  }
  const agente = criarAgente({
    api,
    transporte,
    formatar: () => Buffer.from('recibo'),
    log: { info: (m) => logs.info.push(m), error: (m) => logs.error.push(m) },
    esperar: async () => {},
  })
  return { agente, chamadas, logs }
}

describe('agente: um ciclo', () => {
  it('imprime e SÓ DEPOIS confirma (nunca o contrário)', async () => {
    const { agente, chamadas, logs } = montar()
    assert.equal(await agente.ciclo(), 'impresso')
    assert.deepEqual(chamadas, ['proxima', 'enviar', 'confirmar:job-1'])
    assert.match(logs.info.join(' '), /Pedido 123: impresso/)
  })

  it('fila vazia: não imprime nada', async () => {
    const { agente, chamadas } = montar({ proximas: [] })
    assert.equal(await agente.ciclo(), 'vazio')
    assert.deepEqual(chamadas, ['proxima'])
  })

  it('impressora falhou: NÃO confirma e avisa o banco com o motivo', async () => {
    const { agente, chamadas, logs } = montar({ enviar: () => { throw new Error('sem papel') } })
    assert.equal(await agente.ciclo(), 'falha')
    assert.deepEqual(chamadas, ['proxima', 'enviar', 'falha:job-1:sem papel'])
    assert.ok(!chamadas.some((c) => c.startsWith('confirmar')))
    assert.match(logs.error.join(' '), /NÃO imprimiu \(sem papel\)/)
  })

  it('impressora falhou e o aviso ao banco também falhou: registra e segue (a reserva expira e volta)', async () => {
    const { agente, logs } = montar({
      enviar: () => { throw new Error('offline') },
      falha: () => { throw new Error('sem internet') },
    })
    assert.equal(await agente.ciclo(), 'falha')
    assert.match(logs.error.join(' '), /não consegui avisar o sistema/)
  })

  it('imprimiu mas a confirmação falhou 3 vezes: alerta de possível segunda via', async () => {
    let tentativas = 0
    const { agente, logs } = montar({ confirmar: () => { tentativas++; throw new Error('rede caiu') } })
    assert.equal(await agente.ciclo(), 'impresso_sem_confirmacao')
    assert.equal(tentativas, 3)
    assert.match(logs.error.join(' '), /IMPRESSO, mas NÃO consegui confirmar.*segunda via/)
  })

  it('confirmação que falha uma vez e depois funciona: conta como impresso', async () => {
    let n = 0
    const { agente } = montar({ confirmar: () => { if (++n < 2) throw new Error('instável') } })
    assert.equal(await agente.ciclo(), 'impresso')
    assert.equal(n, 2)
  })

  it('sem conexão: avisa UMA vez (não enche o log) e avisa quando volta', async () => {
    const { agente, logs } = montar({ proximas: [new Error('fetch failed'), new Error('fetch failed'), null] })
    assert.equal(await agente.ciclo(), 'erro_api')
    assert.equal(await agente.ciclo(), 'erro_api')
    assert.equal(logs.error.length, 1)
    assert.equal(await agente.ciclo(), 'vazio')
    assert.match(logs.info.join(' '), /Conexão com o sistema restabelecida/)
  })

  it('o pedido de reimpressão é identificado no log', async () => {
    const { agente, logs } = montar({ proximas: [{ ...JOB, reimpressao: true }] })
    await agente.ciclo()
    assert.match(logs.info.join(' '), /reimpressão/)
  })
})

describe('agente: laço', () => {
  it('imprime todos os pedidos da fila em sequência e para quando mandam parar', async () => {
    const chamadas = []
    const fila = [{ ...JOB, impressao_id: 'a' }, { ...JOB, impressao_id: 'b' }, { ...JOB, impressao_id: 'c' }]
    let agente
    const api = {
      async proxima() { return fila.shift() ?? null },
      async confirmar(id) { chamadas.push(id) },
      async falha() {},
    }
    let esperas = 0
    agente = criarAgente({
      api,
      transporte: { nome: 't', async enviar() {} },
      formatar: () => Buffer.alloc(0),
      log: { info() {}, error() {} },
      esperar: async () => { if (++esperas >= 1) agente.parar() }, // 1ª vez que a fila esvazia, para
    })
    await agente.iniciar()
    assert.deepEqual(chamadas, ['a', 'b', 'c'])
  })

  it('sem internet a espera cresce até 30 s (não martela o servidor)', async () => {
    const espera = []
    let agente
    agente = criarAgente({
      api: { async proxima() { throw new Error('x') }, async confirmar() {}, async falha() {} },
      transporte: { nome: 't', async enviar() {} },
      formatar: () => Buffer.alloc(0),
      log: { info() {}, error() {} },
      intervaloMs: 3000,
      esperar: async (ms) => { espera.push(ms); if (espera.length >= 6) agente.parar() },
    })
    await agente.iniciar()
    assert.deepEqual(espera, [3000, 6000, 12000, 24000, 30000, 30000])
  })
})
