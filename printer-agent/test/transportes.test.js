import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { criarTransporte, transporteArquivo, transporteRede, transporteWindows } from '../src/transportes.js'

/** Servidor TCP de teste que age como uma impressora de rede. `fechar`: fecha a conexão ao terminar? */
function impressoraFalsa({ fechar = true } = {}) {
  const recebido = []
  const servidor = net.createServer((socket) => {
    socket.on('data', (d) => recebido.push(d))
    socket.on('end', () => { if (fechar) socket.end() })
    socket.on('error', () => {})
  })
  return new Promise((resolve) =>
    servidor.listen(0, '127.0.0.1', () =>
      resolve({
        porta: servidor.address().port,
        recebido: () => Buffer.concat(recebido),
        parar: () => new Promise((r) => { servidor.close(r); servidor.closeAllConnections?.() }),
      }),
    ),
  )
}

describe('transporte de rede (servidor TCP de verdade)', () => {
  it('entrega exatamente os bytes do recibo', async () => {
    const p = await impressoraFalsa()
    try {
      const bytes = Buffer.from([0x1b, 0x40, 0x41, 0x42, 0x0a, 0x1d, 0x56, 0x42, 0x03])
      await transporteRede({ host: '127.0.0.1', porta: p.porta }).enviar(bytes)
      await new Promise((r) => setTimeout(r, 50))
      assert.deepEqual(p.recebido(), bytes)
    } finally {
      await p.parar()
    }
  })

  it('impressora que NUNCA fecha a conexão não vira falso erro (evita recibo duplicado)', async () => {
    const p = await impressoraFalsa({ fechar: false })
    try {
      await transporteRede({ host: '127.0.0.1', porta: p.porta, timeoutMs: 2000 }).enviar(Buffer.from('recibo'))
    } finally {
      await p.parar()
    }
  })

  it('impressora desligada (conexão recusada): rejeita com mensagem clara', async () => {
    const p = await impressoraFalsa()
    const porta = p.porta
    await p.parar() // ninguém escutando mais nessa porta
    await assert.rejects(
      transporteRede({ host: '127.0.0.1', porta, timeoutMs: 1000 }).enviar(Buffer.from('x')),
      /impressora de rede/,
    )
  })

  it('envia recibos grandes inteiros', async () => {
    const p = await impressoraFalsa()
    try {
      const bytes = Buffer.alloc(200_000, 0x41)
      await transporteRede({ host: '127.0.0.1', porta: p.porta }).enviar(bytes)
      await new Promise((r) => setTimeout(r, 200))
      assert.equal(p.recebido().length, bytes.length)
    } finally {
      await p.parar()
    }
  })
})

describe('transporte de arquivo (modo de teste)', () => {
  it('grava os bytes e acumula os recibos seguintes', async () => {
    const caminho = join(tmpdir(), `recibo-teste-${Date.now()}.bin`)
    const t = transporteArquivo(caminho)
    await t.enviar(Buffer.from('um'))
    await t.enviar(Buffer.from('dois'))
    assert.equal((await readFile(caminho)).toString(), 'umdois')
  })
})

describe('transporte do Windows (impressora USB compartilhada)', () => {
  const processoFalso = (codigo, saida = '') => {
    const proc = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    queueMicrotask(() => {
      if (saida) proc.stderr.emit('data', saida)
      proc.emit('close', codigo)
    })
    return proc
  }

  it('chama "copy /b arquivo \\\\localhost\\NOME" com o recibo gravado no arquivo e limpa depois', async () => {
    let comando
    let conteudoNaHora
    const executar = (cmd, args) => {
      comando = [cmd, ...args]
      conteudoNaHora = readFile(args[3]) // o arquivo tem que existir DURANTE a chamada
      return processoFalso(0)
    }
    await transporteWindows({ nomeCompartilhado: 'COZINHA', executar }).enviar(Buffer.from('recibo'))
    assert.deepEqual(comando.slice(0, 3), ['cmd', '/c', 'copy'])
    assert.equal(comando[3], '/b')
    assert.equal(comando[5], '\\\\localhost\\COZINHA')
    assert.equal((await conteudoNaHora).toString(), 'recibo')
    await assert.rejects(readFile(comando[4])) // apagado no fim
  })

  it('impressora recusou: rejeita com o código e o motivo', async () => {
    const executar = () => processoFalso(1, 'Acesso negado')
    await assert.rejects(
      transporteWindows({ nomeCompartilhado: 'COZINHA', executar }).enviar(Buffer.from('x')),
      /recusou \(código 1\).*Acesso negado/,
    )
  })
})

describe('criarTransporte', () => {
  it('escolhe pelo tipo e recusa tipo desconhecido', () => {
    assert.match(criarTransporte({ tipo: 'rede', host: '1.2.3.4' }).nome, /rede/)
    assert.match(criarTransporte({ tipo: 'windows', nome: 'X' }).nome, /Windows/)
    assert.match(criarTransporte({ tipo: 'arquivo', arquivo: 'a.bin' }).nome, /arquivo/)
    assert.throws(() => criarTransporte({ tipo: 'bluetooth' }), /desconhecido/)
  })
})
