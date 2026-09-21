import type { SupabaseClient } from '@supabase/supabase-js'

// Exportação de pedidos para planilha (CSV). SÓ o que serve para conferência e contabilidade: nada de
// nome, telefone nem rua do cliente (dado pessoal fica no sistema). Leitura só de admin (RLS).

export type PedidoExportado = {
  numero: number
  criadoEm: string
  canal: string
  tipo: string
  status: string
  pagamentoStatus: string
  pagamentoMetodo: string | null
  bairro: string | null
  subtotalCentavos: number
  taxaEntregaCentavos: number
  descontoCentavos: number
  totalCentavos: number
  /** "2x Smash; 1x Refrigerante" */
  itens: string
}

export type ApiExportacao = {
  /** Datas AAAA-MM-DD do fuso da Bahia (a Bahia não tem horário de verão: é sempre UTC-3). */
  pedidos(inicio: string, fim: string): Promise<PedidoExportado[]>
}

/** Limite de linhas por exportação; acima disso pedimos um período menor em vez de cortar em silêncio. */
export const LIMITE_LINHAS = 5000

type Linha = {
  numero: number | string
  created_at: string
  canal: string
  tipo: string
  status: string
  pagamento_status: string
  pagamento_metodo: string | null
  endereco_bairro: string | null
  subtotal_centavos: number
  taxa_entrega_centavos: number
  desconto_centavos: number
  total_centavos: number
  itens_pedido: { nome: string; quantidade: number }[] | null
}

/** Dia seguinte (AAAA-MM-DD), em UTC para não haver surpresa de fuso. */
function diaSeguinte(data: string): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10)
}

export function criarExportacaoSupabase(cliente: SupabaseClient): ApiExportacao {
  return {
    async pedidos(inicio, fim) {
      const { data, error } = await cliente
        .from('pedidos')
        .select(
          'numero, created_at, canal, tipo, status, pagamento_status, pagamento_metodo, endereco_bairro, subtotal_centavos, taxa_entrega_centavos, desconto_centavos, total_centavos, itens_pedido(nome, quantidade)',
        )
        .gte('created_at', `${inicio}T00:00:00-03:00`)
        .lt('created_at', `${diaSeguinte(fim)}T00:00:00-03:00`)
        .order('created_at', { ascending: true })
        .limit(LIMITE_LINHAS + 1)
      if (error) throw new Error(error.message)
      const linhas = data as unknown as Linha[]
      if (linhas.length > LIMITE_LINHAS) {
        throw new Error(`Mais de ${LIMITE_LINHAS} pedidos no período; escolha um período menor.`)
      }
      return linhas.map((l) => ({
        numero: Number(l.numero),
        criadoEm: l.created_at,
        canal: l.canal,
        tipo: l.tipo,
        status: l.status,
        pagamentoStatus: l.pagamento_status,
        pagamentoMetodo: l.pagamento_metodo,
        bairro: l.endereco_bairro,
        subtotalCentavos: l.subtotal_centavos,
        taxaEntregaCentavos: l.taxa_entrega_centavos,
        descontoCentavos: l.desconto_centavos,
        totalCentavos: l.total_centavos,
        itens: (l.itens_pedido ?? []).map((i) => `${i.quantidade}x ${i.nome}`).join('; '),
      }))
    },
  }
}
