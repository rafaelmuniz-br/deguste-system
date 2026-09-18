import { createContext } from 'react'
import type { ApiAcompanhamento } from '../data/acompanhamentoApi.ts'
import type { ApiPedidos } from '../data/pedidosApi.ts'
import type { Cardapio } from '../domain/tipos.ts'

export type ValorLoja = {
  cardapio: Cardapio
  /** true = dados de desenvolvimento (não é o cardápio real). */
  ehExemplo: boolean
  /** true = pedidos NÃO vão a lugar nenhum (só desenvolvimento). Nunca é true em produção. */
  apiSimulada: boolean
  api: ApiPedidos
  acompanhamento: ApiAcompanhamento
}

export const ContextoLoja = createContext<ValorLoja | null>(null)
