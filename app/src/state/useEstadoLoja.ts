import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { estadoLoja, type EstadoLoja } from '../domain/horario.ts'
import type { ConfigLoja } from '../domain/tipos.ts'

/** Reavalia a cada 30s para a loja abrir/fechar sozinha com a página aberta. */
export function useEstadoLoja(loja: ConfigLoja): EstadoLoja {
  const [agora, setAgora] = useState(() => new Date())
  const [params] = useSearchParams()

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Só em desenvolvimento: ?loja=aberta / ?loja=fechada para testar as duas telas.
  const forcado = import.meta.env.DEV ? params.get('loja') : null
  if (forcado === 'aberta') return estadoLoja({ ...loja, modo: 'forcar_aberta' }, agora)
  if (forcado === 'fechada') return estadoLoja({ ...loja, modo: 'forcar_fechada' }, agora)
  return estadoLoja(loja, agora)
}
