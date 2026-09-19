import { describe, expect, it } from 'vitest'
import { minutosRestantes } from './pix.ts'

describe('minutosRestantes', () => {
  const agora = new Date('2026-09-18T20:00:00Z')
  it('arredonda para cima (faltando 10 s ainda são "1 min", nunca "0 min" com o Pix valendo)', () => {
    expect(minutosRestantes('2026-09-18T20:30:00Z', agora)).toBe(30)
    expect(minutosRestantes('2026-09-18T20:00:10Z', agora)).toBe(1)
    expect(minutosRestantes('2026-09-18T20:01:01Z', agora)).toBe(2)
  })
  it('venceu: 0', () => {
    expect(minutosRestantes('2026-09-18T20:00:00Z', agora)).toBe(0)
    expect(minutosRestantes('2026-09-18T19:00:00Z', agora)).toBe(0)
  })
  it('sem prazo ou prazo inválido: null', () => {
    expect(minutosRestantes(undefined, agora)).toBeNull()
    expect(minutosRestantes('lixo', agora)).toBeNull()
  })
})
