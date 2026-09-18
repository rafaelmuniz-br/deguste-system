import { describe, expect, it } from 'vitest'
import { cardapioExemplo } from '../data/exemplo.ts'
import { descreverEstado, estadoLoja } from './horario.ts'

const loja = cardapioExemplo.loja // qua–dom, 18h–22h, America/Bahia (UTC-3, sem horário de verão)

describe('estadoLoja', () => {
  it('sexta 17:00 (Bahia): fechada, abre hoje às 18:00', () => {
    const e = estadoLoja(loja, new Date('2026-09-18T20:00:00Z'))
    expect(e.aberta).toBe(false)
    expect(descreverEstado(e)).toBe('Fechado · abrimos hoje às 18:00')
  })

  it('sexta 18:30 (Bahia): aberta até 22:00', () => {
    const e = estadoLoja(loja, new Date('2026-09-18T21:30:00Z'))
    expect(e.aberta).toBe(true)
    expect(descreverEstado(e)).toBe('Aberto agora · fechamos às 22:00')
  })

  it('exatamente às 22:00 já está fechada; às 18:00 já está aberta', () => {
    expect(estadoLoja(loja, new Date('2026-09-19T01:00:00Z')).aberta).toBe(false) // sex 22:00
    expect(estadoLoja(loja, new Date('2026-09-18T21:00:00Z')).aberta).toBe(true) // sex 18:00
  })

  it('usa o fuso da loja, não o do aparelho: 00:30 UTC de sábado ainda é sexta 21:30 na Bahia', () => {
    expect(estadoLoja(loja, new Date('2026-09-19T00:30:00Z')).aberta).toBe(true)
  })

  it('terça (fechada o dia todo): abre quarta às 18:00', () => {
    const e = estadoLoja(loja, new Date('2026-09-22T15:00:00Z')) // terça 12:00
    expect(e.aberta).toBe(false)
    expect(descreverEstado(e)).toBe('Fechado · abrimos amanhã às 18:00')
  })

  it('domingo 22:30: próxima abertura é quarta', () => {
    const e = estadoLoja(loja, new Date('2026-09-21T01:30:00Z')) // dom 20/09 22:30 Bahia
    expect(e.aberta).toBe(false)
    expect(descreverEstado(e)).toBe('Fechado · abrimos quarta às 18:00')
  })

  it('modo manual sobrepõe o horário', () => {
    const fora = new Date('2026-09-22T15:00:00Z')
    expect(estadoLoja({ ...loja, modo: 'forcar_aberta' }, fora).aberta).toBe(true)
    expect(
      estadoLoja({ ...loja, modo: 'forcar_fechada' }, new Date('2026-09-18T21:30:00Z')).aberta,
    ).toBe(false)
  })

  it('sem nenhum horário cadastrado: fechada, sem próxima abertura', () => {
    const e = estadoLoja({ ...loja, horarios: [] }, new Date('2026-09-18T21:30:00Z'))
    expect(e.aberta).toBe(false)
    expect(descreverEstado(e)).toBe('Fechado no momento')
  })
})
