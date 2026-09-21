import { describe, expect, it } from 'vitest'
import {
  hojeNaBahia,
  mapearRelatorio,
  percentualDaBarra,
  periodoPredefinido,
  rotuloCanal,
  rotuloDoDia,
  rotuloHora,
  somarDias,
  validarPeriodo,
  type RelatorioBruto,
} from './relatorios.ts'

describe('hojeNaBahia', () => {
  it('usa o fuso da Bahia (UTC-3): 01:30 UTC do dia 11 ainda é dia 10 em Salvador', () => {
    expect(hojeNaBahia(new Date('2026-09-11T01:30:00Z'))).toBe('2026-09-10')
    expect(hojeNaBahia(new Date('2026-09-11T03:30:00Z'))).toBe('2026-09-11')
  })
})

describe('somarDias', () => {
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-09-10', -6)).toBe('2026-09-04')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('periodoPredefinido', () => {
  const agora = new Date('2026-09-18T15:00:00Z') // 12:00 na Bahia
  it.each([
    ['hoje', '2026-09-18', '2026-09-18'],
    ['ontem', '2026-09-17', '2026-09-17'],
    ['7dias', '2026-09-12', '2026-09-18'],
    ['30dias', '2026-08-20', '2026-09-18'],
    ['mes', '2026-09-01', '2026-09-18'],
  ] as const)('%s', (id, inicio, fim) => {
    expect(periodoPredefinido(id, agora)).toEqual({ inicio, fim })
  })

  it('perto da meia-noite usa a data da Bahia, não a UTC', () => {
    const tarde = new Date('2026-09-19T01:00:00Z') // 22:00 do dia 18 na Bahia
    expect(periodoPredefinido('hoje', tarde)).toEqual({ inicio: '2026-09-18', fim: '2026-09-18' })
  })
})

describe('validarPeriodo', () => {
  it('aceita período válido', () => {
    expect(validarPeriodo('2026-09-01', '2026-09-18')).toBeNull()
    expect(validarPeriodo('2026-09-18', '2026-09-18')).toBeNull()
  })
  it('recusa vazio, invertido e longo demais', () => {
    expect(validarPeriodo('', '2026-09-18')).toMatch(/duas datas/)
    expect(validarPeriodo('2026-09-18', '2026-09-01')).toMatch(/antes da inicial/)
    expect(validarPeriodo('2024-01-01', '2026-01-01')).toMatch(/1 ano/)
  })
})

describe('apresentação', () => {
  it('rótulos', () => {
    expect(rotuloDoDia('2026-09-10')).toBe('qui 10/09')
    expect(rotuloDoDia('2026-09-13')).toBe('dom 13/09')
    expect(rotuloCanal('ifood')).toBe('iFood')
    expect(rotuloCanal('proprio')).toBe('Site próprio')
    expect(rotuloCanal('novo-canal')).toBe('novo-canal')
    expect(rotuloHora(9)).toBe('09h')
  })

  it('barra proporcional, com mínimo visível e sem dividir por zero', () => {
    expect(percentualDaBarra(50, 100)).toBe(50)
    expect(percentualDaBarra(100, 100)).toBe(100)
    expect(percentualDaBarra(1, 1000)).toBe(2)
    expect(percentualDaBarra(0, 100)).toBe(0)
    expect(percentualDaBarra(5, 0)).toBe(0)
  })
})

describe('mapearRelatorio', () => {
  it('converte snake_case e números que chegam como texto (bigint)', () => {
    const bruto: RelatorioBruto = {
      periodo: { inicio: '2026-09-10', fim: '2026-09-11' },
      resumo: {
        pedidos: '4',
        receita_centavos: '13995',
        ticket_medio_centavos: 3499,
        cancelados: 1,
      },
      por_dia: [{ dia: '2026-09-10', pedidos: '3', receita_centavos: 10596 }],
      por_canal: [{ canal: 'proprio', pedidos: 3, receita_centavos: '9996' }],
      por_tipo: [{ tipo: 'entrega', pedidos: 1, receita_centavos: 3999 }],
      por_hora: [{ hora: 19, pedidos: '2' }],
      produtos: [
        {
          produto_id: 'p1',
          nome: 'Smash',
          unidades: '3',
          unidades_em_combo: 0,
          receita_avulsa_centavos: '6597',
        },
      ],
    }
    expect(mapearRelatorio(bruto)).toEqual({
      inicio: '2026-09-10',
      fim: '2026-09-11',
      resumo: { pedidos: 4, receitaCentavos: 13995, ticketMedioCentavos: 3499, cancelados: 1 },
      porDia: [{ dia: '2026-09-10', pedidos: 3, receitaCentavos: 10596 }],
      porCanal: [{ canal: 'proprio', pedidos: 3, receitaCentavos: 9996 }],
      porTipo: [{ tipo: 'entrega', pedidos: 1, receitaCentavos: 3999 }],
      porHora: [{ hora: 19, pedidos: 2 }],
      produtos: [
        {
          produtoId: 'p1',
          nome: 'Smash',
          unidades: 3,
          unidadesEmCombo: 0,
          receitaAvulsaCentavos: 6597,
        },
      ],
    })
  })
})
