import { useContext } from 'react'
import { ContextoLoja } from './contextoLoja.ts'

export function useLoja() {
  const valor = useContext(ContextoLoja)
  if (!valor) throw new Error('useLoja precisa estar dentro de <LojaLayout>')
  return valor
}
