import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tocarAlerta, useAlertaSonoro } from './useAlertaSonoro.ts'

function contextoFalso() {
  const osciladores: { start: ReturnType<typeof vi.fn> }[] = []
  const ctx = {
    currentTime: 10,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const osc = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      osciladores.push(osc)
      return osc
    }),
    createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
  }
  return { ctx: ctx as unknown as AudioContext, bruto: ctx, osciladores }
}

describe('tocarAlerta', () => {
  it('toca três bipes agudos espaçados', () => {
    const { ctx, osciladores } = contextoFalso()
    tocarAlerta(ctx)
    expect(osciladores).toHaveLength(3)
    expect(osciladores.map((o) => o.start.mock.calls[0][0])).toEqual([10, 10.3, 10.6])
  })
})

describe('useAlertaSonoro', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function montar(novosInicial: number, ativoInicial: boolean) {
    const { ctx, bruto } = contextoFalso()
    const criar = vi.fn(() => ctx)
    const hook = renderHook(({ novos, ativo }) => useAlertaSonoro(novos, ativo, criar), {
      initialProps: { novos: novosInicial, ativo: ativoInicial },
    })
    return { ...hook, criar, bruto }
  }

  it('toca quando chega pedido novo e repete a cada 20 s enquanto houver pedido novo', () => {
    const { rerender, bruto } = montar(0, true)
    expect(bruto.createOscillator).not.toHaveBeenCalled()

    rerender({ novos: 1, ativo: true })
    expect(bruto.createOscillator).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(20_000)
    expect(bruto.createOscillator).toHaveBeenCalledTimes(6)

    rerender({ novos: 0, ativo: true }) // atendeu: para de repetir
    vi.advanceTimersByTime(60_000)
    expect(bruto.createOscillator).toHaveBeenCalledTimes(6)
  })

  it('sem som ativado não toca nem cria o contexto de áudio', () => {
    const { rerender, criar } = montar(0, false)
    rerender({ novos: 2, ativo: false })
    vi.advanceTimersByTime(60_000)
    expect(criar).not.toHaveBeenCalled()
  })

  it('não toca de novo se o número de pedidos novos só diminui', () => {
    const { rerender, bruto } = montar(0, true)
    rerender({ novos: 2, ativo: true })
    const antes = bruto.createOscillator.mock.calls.length
    rerender({ novos: 1, ativo: true })
    expect(bruto.createOscillator.mock.calls.length).toBe(antes)
  })

  it('aparelho sem áudio não quebra a tela', () => {
    const criar = vi.fn(() => {
      throw new Error('sem áudio')
    })
    const { rerender } = renderHook(({ novos }) => useAlertaSonoro(novos, true, criar), {
      initialProps: { novos: 0 },
    })
    expect(() => rerender({ novos: 1 })).not.toThrow()
  })
})
