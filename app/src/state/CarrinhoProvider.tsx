import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import {
  carregarSacola,
  carrinhoReducer,
  resolverCarrinho,
  salvarSacola,
  subtotal,
} from '../domain/carrinho.ts'
import type { Cardapio } from '../domain/tipos.ts'
import { ContextoCarrinho } from './contextoCarrinho.ts'

export default function CarrinhoProvider({
  cardapio,
  children,
}: {
  cardapio: Cardapio
  children: ReactNode
}) {
  const [linhasBrutas, dispatch] = useReducer(carrinhoReducer, undefined, carregarSacola)

  useEffect(() => {
    salvarSacola(linhasBrutas)
  }, [linhasBrutas])

  const valor = useMemo(() => {
    // Linhas de produtos que saíram do cardápio são ignoradas na exibição.
    const linhas = resolverCarrinho(cardapio, linhasBrutas)
    return {
      linhas,
      quantidadeTotal: linhas.reduce((n, l) => n + l.quantidade, 0),
      subtotalCentavos: subtotal(linhas),
      dispatch,
    }
  }, [cardapio, linhasBrutas])

  return <ContextoCarrinho.Provider value={valor}>{children}</ContextoCarrinho.Provider>
}
