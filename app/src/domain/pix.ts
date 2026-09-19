/** Minutos que faltam para o Pix vencer (arredondado para cima), 0 se já venceu; null se não sabemos o prazo. */
export function minutosRestantes(expiraEm: string | undefined, agora: Date): number | null {
  if (!expiraEm) return null
  const ms = new Date(expiraEm).getTime() - agora.getTime()
  if (Number.isNaN(ms)) return null
  return ms <= 0 ? 0 : Math.ceil(ms / 60_000)
}
