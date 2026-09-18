import type { SupabaseClient } from '@supabase/supabase-js'
import type { StatusPagamento, StatusPedido, TipoPedido } from '../domain/andamento.ts'

// Acompanhamento do pedido SEM login: o cliente usa o token do pedido (UUID aleatório). O banco só
// devolve o mínimo (número, tipo, status, pagamento, total). Ver `acompanhar_pedido` em
// supabase/migrations/*_pedido_atomico.sql e docs/arquitetura-pedido.md.

export type PedidoAcompanhado = {
  numero: number
  tipo: TipoPedido
  status: StatusPedido
  pagamentoStatus: StatusPagamento
  totalCentavos: number
  criadoEm: string
  /** Código "copia e cola" do Pix; só existe enquanto dá para pagar. */
  pixCopiaCola?: string
  /** Até quando o Pix pode ser pago. */
  pagamentoExpiraEm?: string
}

export type RespostaAcompanhamento =
  { ok: true; pedido: PedidoAcompanhado } | { ok: false; motivo: 'nao_encontrado' | 'indisponivel' }

export type ApiAcompanhamento = { buscar(token: string): Promise<RespostaAcompanhamento> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LinhaStatus = {
  numero: number | string
  tipo: TipoPedido
  status: StatusPedido
  pagamento_status: StatusPagamento
  total_centavos: number
  criado_em: string
  pix_copia_cola?: string | null
  pagamento_expira_em?: string | null
}

export function criarAcompanhamentoSupabase(cliente: SupabaseClient | null): ApiAcompanhamento {
  return {
    async buscar(token) {
      // Token que nem parece um UUID nunca chega ao banco.
      if (!UUID.test(token)) return { ok: false, motivo: 'nao_encontrado' }
      if (!cliente) return { ok: false, motivo: 'indisponivel' }
      try {
        const { data, error } = await cliente.rpc('acompanhar_pedido', { p_token: token })
        if (error) return { ok: false, motivo: 'indisponivel' }
        const linha = (Array.isArray(data) ? data[0] : data) as LinhaStatus | undefined
        if (!linha) return { ok: false, motivo: 'nao_encontrado' }
        return {
          ok: true,
          pedido: {
            numero: Number(linha.numero),
            tipo: linha.tipo,
            status: linha.status,
            pagamentoStatus: linha.pagamento_status,
            totalCentavos: linha.total_centavos,
            criadoEm: linha.criado_em,
            pixCopiaCola: linha.pix_copia_cola ?? undefined,
            pagamentoExpiraEm: linha.pagamento_expira_em ?? undefined,
          },
        }
      } catch {
        return { ok: false, motivo: 'indisponivel' }
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// SIMULAÇÃO (só desenvolvimento). Guarda os pedidos simulados no navegador e faz o status
// "andar" com o tempo, para dar para ver a linha do tempo funcionando sem cozinha nem Pix.
// ---------------------------------------------------------------------------------------------

const CHAVE_SIMULADOS = 'deguste:dev-pedidos'

type Simulado = { numero: number; tipo: TipoPedido; totalCentavos: number; criadoEm: number }

function lerSimulados(): Record<string, Simulado> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_SIMULADOS) ?? '{}') as Record<string, Simulado>
  } catch {
    return {}
  }
}

export function registrarPedidoSimulado(
  token: string,
  dados: { numero: number; tipo: TipoPedido; totalCentavos: number },
  agora = () => Date.now(),
) {
  try {
    localStorage.setItem(
      CHAVE_SIMULADOS,
      JSON.stringify({ ...lerSimulados(), [token]: { ...dados, criadoEm: agora() } }),
    )
  } catch {
    // sem armazenamento: a tela de acompanhamento simulada só não acha o pedido
  }
}

/** A cada 15 s de vida o pedido avança um status: pagamento → fila → preparo → pronto → concluído. */
const LINHA_DO_TEMPO_SIMULADA: StatusPedido[] = [
  'aguardando_pagamento',
  'novo',
  'em_preparo',
  'pronto',
  'concluido',
]

export function criarAcompanhamentoSimulado(agora = () => Date.now()): ApiAcompanhamento {
  return {
    async buscar(token) {
      const s = lerSimulados()[token]
      if (!s) return { ok: false, motivo: 'nao_encontrado' }
      const indice = Math.min(
        LINHA_DO_TEMPO_SIMULADA.length - 1,
        Math.floor((agora() - s.criadoEm) / 15_000),
      )
      const status = LINHA_DO_TEMPO_SIMULADA[indice]
      return {
        ok: true,
        pedido: {
          numero: s.numero,
          tipo: s.tipo,
          status,
          pagamentoStatus: status === 'aguardando_pagamento' ? 'pendente' : 'pago',
          totalCentavos: s.totalCentavos,
          criadoEm: new Date(s.criadoEm).toISOString(),
        },
      }
    },
  }
}
