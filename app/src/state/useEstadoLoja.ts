import { useEffect, useState } from 'react'
import { estadoLoja, type EstadoLoja } from '../domain/horario.ts'
import type { ConfigLoja } from '../domain/tipos.ts'

/** Reavalia a cada 30s para a loja abrir/fechar sozinha com a página aberta. */
export function useEstadoLoja(loja: ConfigLoja): EstadoLoja {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return estadoLoja(loja, agora)
}
