import { useContext } from 'react'
import { ContextoCarrinho } from './contextoCarrinho.ts'

export function useCarrinho() {
  const valor = useContext(ContextoCarrinho)
  if (!valor) throw new Error('useCarrinho precisa estar dentro de <CarrinhoProvider>')
  return valor
}
