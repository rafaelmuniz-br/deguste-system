import { createContext } from 'react'
import type { Acao, LinhaResolvida } from '../domain/carrinho.ts'

export type ValorCarrinho = {
  linhas: LinhaResolvida[]
  quantidadeTotal: number
  subtotalCentavos: number
  dispatch: (acao: Acao) => void
}

export const ContextoCarrinho = createContext<ValorCarrinho | null>(null)
