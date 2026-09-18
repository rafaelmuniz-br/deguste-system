import { describe, expect, it } from 'vitest'
import { calcularFrete, distanciaLinhaRetaKm, normalizarBairro } from './frete.ts'
import { formatarTelefone, normalizarTelefone } from './telefone.ts'
import type { ZonaEntrega } from './tipos.ts'

const porKm: ZonaEntrega = {
  regra: { tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 },
  raioMaximoKm: 6,
}

const faixas: ZonaEntrega = {
  regra: {
    tipo: 'faixas_km',
    // fora de ordem de propósito: o cálculo não pode depender da ordem
    faixas: [
      { ateKm: 4, taxaCentavos: 800 },
      { ateKm: 2, taxaCentavos: 500 },
      { ateKm: 6, taxaCentavos: 1200 },
    ],
  },
  raioMaximoKm: 6,
}

const porBairro: ZonaEntrega = {
  regra: { tipo: 'por_bairro', bairros: { pituba: 700, 'rio vermelho': 900 } },
  raioMaximoKm: 10,
}

describe('calcularFrete por km', () => {
  it('cobra base + valor por km, em centavos inteiros', () => {
    expect(calcularFrete(porKm, { distanciaKm: 3.5 })).toEqual({
      ok: true,
      taxaCentavos: 500 + 525,
      distanciaKm: 3.5,
    })
    expect(calcularFrete(porKm, { distanciaKm: 0 })).toEqual({
      ok: true,
      taxaCentavos: 500,
      distanciaKm: 0,
    })
  })

  it('arredonda a distância a 2 casas antes de cobrar', () => {
    const r = calcularFrete(porKm, { distanciaKm: 2.3456 })
    expect(r).toEqual({ ok: true, taxaCentavos: 500 + Math.round(150 * 2.35), distanciaKm: 2.35 })
  })

  it('o limite do raio é inclusivo; passou dele, recusa', () => {
    expect(calcularFrete(porKm, { distanciaKm: 6 }).ok).toBe(true)
    expect(calcularFrete(porKm, { distanciaKm: 6.004 }).ok).toBe(true) // arredonda para 6.00
    expect(calcularFrete(porKm, { distanciaKm: 6.01 })).toEqual({
      ok: false,
      motivo: 'FORA_DA_AREA',
    })
  })

  it('sem distância válida, recusa em vez de chutar preço', () => {
    for (const km of [undefined, NaN, Infinity, -1]) {
      expect(calcularFrete(porKm, { distanciaKm: km })).toEqual({
        ok: false,
        motivo: 'DISTANCIA_INDISPONIVEL',
      })
    }
  })
})

describe('calcularFrete por faixas', () => {
  it('usa a menor faixa que comporta a distância, independente da ordem cadastrada', () => {
    expect(calcularFrete(faixas, { distanciaKm: 1 })).toMatchObject({ ok: true, taxaCentavos: 500 })
    expect(calcularFrete(faixas, { distanciaKm: 2 })).toMatchObject({ ok: true, taxaCentavos: 500 })
    expect(calcularFrete(faixas, { distanciaKm: 2.01 })).toMatchObject({ taxaCentavos: 800 })
    expect(calcularFrete(faixas, { distanciaKm: 5.5 })).toMatchObject({ taxaCentavos: 1200 })
  })

  it('além da última faixa ou do raio: fora da área', () => {
    expect(calcularFrete(faixas, { distanciaKm: 6.5 })).toEqual({
      ok: false,
      motivo: 'FORA_DA_AREA',
    })
    const curto: ZonaEntrega = { ...faixas, raioMaximoKm: 10 }
    expect(calcularFrete(curto, { distanciaKm: 7 })).toEqual({ ok: false, motivo: 'FORA_DA_AREA' })
  })
})

describe('calcularFrete por bairro', () => {
  it('acha o bairro sem diferenciar acento, maiúscula e espaços', () => {
    expect(calcularFrete(porBairro, { bairro: '  PITUBA ' })).toEqual({
      ok: true,
      taxaCentavos: 700,
    })
    expect(calcularFrete(porBairro, { bairro: 'Rio  Vermelho' })).toEqual({
      ok: true,
      taxaCentavos: 900,
    })
  })

  it('bairro não atendido ou ausente: fora da área (não precisa de distância)', () => {
    expect(calcularFrete(porBairro, { bairro: 'Paripe' })).toEqual({
      ok: false,
      motivo: 'FORA_DA_AREA',
    })
    expect(calcularFrete(porBairro, {})).toEqual({ ok: false, motivo: 'FORA_DA_AREA' })
  })

  it('normalizarBairro remove acentos', () => {
    expect(normalizarBairro('Ondina ')).toBe('ondina')
    expect(normalizarBairro('São Caetano')).toBe('sao caetano')
  })
})

describe('distanciaLinhaRetaKm', () => {
  it('Farol da Barra até o Pelourinho: cerca de 5 km', () => {
    const km = distanciaLinhaRetaKm(
      { latitude: -13.0104, longitude: -38.5326 },
      { latitude: -12.9714, longitude: -38.5124 },
    )
    expect(km).toBeGreaterThan(4)
    expect(km).toBeLessThan(6)
  })

  it('mesmo ponto = 0 km', () => {
    const p = { latitude: -13, longitude: -38.5 }
    expect(distanciaLinhaRetaKm(p, p)).toBe(0)
  })
})

describe('normalizarTelefone', () => {
  it('aceita formatos comuns e devolve só dígitos com DDD', () => {
    expect(normalizarTelefone('(71) 99999-1234')).toBe('71999991234')
    expect(normalizarTelefone('+55 71 99999-1234')).toBe('71999991234')
    expect(normalizarTelefone('5571999991234')).toBe('71999991234')
    expect(normalizarTelefone('71 3333-4444')).toBe('7133334444') // fixo
  })

  it('rejeita número curto, DDD inválido e celular sem o 9', () => {
    expect(normalizarTelefone('99999-1234')).toBeNull()
    expect(normalizarTelefone('(01) 99999-1234')).toBeNull()
    expect(normalizarTelefone('(71) 89999-1234')).toBeNull()
    expect(normalizarTelefone('abc')).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
  })
})

describe('formatarTelefone', () => {
  it('formata celular e fixo; devolve o original se não reconhecer', () => {
    expect(formatarTelefone('71999991234')).toBe('(71) 99999-1234')
    expect(formatarTelefone('7133334444')).toBe('(71) 3333-4444')
    expect(formatarTelefone('123')).toBe('123')
  })
})
