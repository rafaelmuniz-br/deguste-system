import { useContext } from 'react'
import { ContextoAuth } from './contextoAuth.ts'

export function useAuth() {
  const valor = useContext(ContextoAuth)
  if (!valor) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return valor
}
