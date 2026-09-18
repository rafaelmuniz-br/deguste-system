// Função AGENDADA (a cada 5 minutos): cancela pedidos que ninguém pagou a tempo e libera o limite
// anti-spam do telefone. A regra está no banco (expirar_pedidos_pendentes). Ver docs/pagamento.md.
import { expirarPedidosPendentes } from '../../src/server/pix/dependenciasPix.ts'

export default async () => {
  try {
    const n = await expirarPedidosPendentes(process.env)
    console.log(`expirar-pedidos: ${n} pedido(s) cancelado(s) por falta de pagamento`)
  } catch (e) {
    console.error('expirar-pedidos: falhou', e instanceof Error ? e.message : 'erro desconhecido')
  }
}

export const config = { schedule: '*/5 * * * *' }
