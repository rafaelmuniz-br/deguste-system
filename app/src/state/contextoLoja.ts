import { createContext } from 'react'
import type { ApiPedidos } from '../data/pedidosApi.ts'
import type { Cardapio } from '../domain/tipos.ts'

export type ValorLoja = {
  cardapio: Cardapio
  /** true = dados de desenvolvimento (não é o cardápio real). */
  ehExemplo: boolean
  api: ApiPedidos
}

export const ContextoLoja = createContext<ValorLoja | null>(null)
