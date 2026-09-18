import { spawn } from 'node:child_process'
import { writeFile, appendFile, mkdtemp, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Como os bytes chegam à impressora. Cada transporte tem `enviar(bytes)` que só resolve quando o
// destino ACEITOU os dados; se algo falhar, rejeita (e o agente registra a falha e tenta de novo).

/** Modo de teste: não usa impressora. Grava em arquivo (para conferir o layout). */
export function transporteArquivo(caminho) {
  return {
    nome: `arquivo (${caminho})`,
    async enviar(bytes) {
      await appendFile(caminho, bytes)
    },
  }
}

/** Impressora de rede (ou Wi-Fi): conexão TCP na porta 9100 (padrão das térmicas de rede). */
export function transporteRede({ host, porta = 9100, timeoutMs = 5000 }) {
  return {
    nome: `rede (${host}:${porta})`,
    enviar(bytes) {
      return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port: porta })
        const falhar = (erro) => {
          socket.destroy()
          reject(new Error(`impressora de rede: ${erro.message ?? erro}`))
        }
        socket.setTimeout(timeoutMs, () => falhar(new Error('tempo esgotado')))
        socket.once('error', falhar)
        socket.once('connect', () => {
          // end(bytes) envia e fecha o nosso lado. 'finish' = tudo foi entregue à impressora.
          // NÃO esperamos a impressora fechar a conexão: muitas nunca fecham, e tratar isso como
          // falha faria o agente imprimir em duplicidade.
          socket.end(bytes)
        })
        socket.once('finish', () => {
          socket.destroy()
          resolve()
        })
      })
    },
  }
}

/**
 * Impressora USB compartilhada no Windows (o caso mais comum): manda os bytes "crus" para
 * \\localhost\NOME. No Windows: Painel de Controle → Impressoras → Compartilhar, com o nome sem espaços.
 * `executar` é injetável para teste.
 */
export function transporteWindows({ nomeCompartilhado, executar = spawn }) {
  return {
    nome: `Windows (\\\\localhost\\${nomeCompartilhado})`,
    async enviar(bytes) {
      const pasta = await mkdtemp(join(tmpdir(), 'deguste-recibo-'))
      const arquivo = join(pasta, 'recibo.bin')
      try {
        await writeFile(arquivo, bytes)
        await new Promise((resolve, reject) => {
          const proc = executar('cmd', ['/c', 'copy', '/b', arquivo, `\\\\localhost\\${nomeCompartilhado}`], {
            windowsHide: true,
          })
          let saida = ''
          proc.stdout?.on('data', (d) => (saida += d))
          proc.stderr?.on('data', (d) => (saida += d))
          proc.once('error', reject)
          proc.once('close', (codigo) =>
            codigo === 0
              ? resolve()
              : reject(new Error(`impressora do Windows recusou (código ${codigo}) ${saida.trim().slice(0, 120)}`)),
          )
        })
      } finally {
        await rm(pasta, { recursive: true, force: true })
      }
    },
  }
}

export function criarTransporte(config) {
  switch (config.tipo) {
    case 'arquivo':
      return transporteArquivo(config.arquivo)
    case 'rede':
      return transporteRede({ host: config.host, porta: config.porta })
    case 'windows':
      return transporteWindows({ nomeCompartilhado: config.nome })
    default:
      throw new Error(`Tipo de impressora desconhecido: "${config.tipo}". Use arquivo, rede ou windows.`)
  }
}
