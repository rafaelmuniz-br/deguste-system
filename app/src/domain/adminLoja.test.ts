import { describe, expect, it } from 'vitest'
import {
  dadosParaForm,
  resumoDoDia,
  validarLoja,
  type DadosLoja,
  type FormLoja,
} from './adminLoja.ts'

const dados: DadosLoja = {
  nome: 'Deguste Burguer',
  modo: 'automatico',
  endereco: 'Rua A, 10',
  latitude: -12.9714,
  longitude: -38.5014,
  freteBaseCentavos: 500,
  fretePorKmCentavos: 150,
  raioMaximoKm: 6.5,
  pedidoMinimoCentavos: 0,
  tempoPreparoMin: 30,
  horarios: [
    { dia: 3, abre: '18:00:00', fecha: '22:00:00' },
    { dia: 0, abre: '18:00', fecha: '22:00' },
  ],
}

const form = (extra: Partial<FormLoja> = {}): FormLoja => ({ ...dadosParaForm(dados), ...extra })

describe('dadosParaForm', () => {
  it('mostra dinheiro em reais, decimais com vírgula e horários sem segundos', () => {
    expect(dadosParaForm(dados)).toEqual({
      nome: 'Deguste Burguer',
      modo: 'automatico',
      endereco: 'Rua A, 10',
      latitude: '-12,9714',
      longitude: '-38,5014',
      freteBase: '5,00',
      fretePorKm: '1,50',
      raioKm: '6,5',
      pedidoMinimo: '0,00',
      tempoPreparo: '30',
      horarios: [
        { dia: 3, abre: '18:00', fecha: '22:00' },
        { dia: 0, abre: '18:00', fecha: '22:00' },
      ],
    })
  })

  it('sem coordenadas nem endereço: campos vazios', () => {
    const f = dadosParaForm({ ...dados, endereco: null, latitude: null, longitude: null })
    expect([f.endereco, f.latitude, f.longitude]).toEqual(['', '', ''])
  })
})

describe('validarLoja', () => {
  it('ida e volta: o que veio do banco é aceito sem mudar nada (exceto ordenar horários)', () => {
    const r = validarLoja(form())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valor).toEqual({
        ...dados,
        horarios: [
          { dia: 0, abre: '18:00', fecha: '22:00' },
          { dia: 3, abre: '18:00', fecha: '22:00' },
        ],
      })
    }
  })

  it('converte reais em centavos e aceita vírgula ou ponto no raio', () => {
    const r = validarLoja(
      form({ freteBase: '7,5', fretePorKm: '2', pedidoMinimo: 'R$ 20', raioKm: '8.25' }),
    )
    expect(
      r.ok && [
        r.valor.freteBaseCentavos,
        r.valor.fretePorKmCentavos,
        r.valor.pedidoMinimoCentavos,
        r.valor.raioMaximoKm,
      ],
    ).toEqual([750, 200, 2000, 8.25])
  })

  it('dinheiro em branco vale zero (frete grátis, sem mínimo)', () => {
    const r = validarLoja(form({ freteBase: '', fretePorKm: ' ', pedidoMinimo: '' }))
    expect(
      r.ok && [r.valor.freteBaseCentavos, r.valor.fretePorKmCentavos, r.valor.pedidoMinimoCentavos],
    ).toEqual([0, 0, 0])
  })

  it('recusa dinheiro inválido, raio fora da faixa e tempo fora da faixa', () => {
    const r = validarLoja(form({ freteBase: 'abc', raioKm: '0', tempoPreparo: '3' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros).toHaveLength(3)
    expect(validarLoja(form({ raioKm: '80' })).ok).toBe(false)
    expect(validarLoja(form({ tempoPreparo: '30,5' })).ok).toBe(false)
    expect(validarLoja(form({ tempoPreparo: '241' })).ok).toBe(false)
  })

  it('coordenadas: as duas ou nenhuma, dentro dos limites', () => {
    expect(validarLoja(form({ latitude: '', longitude: '' })).ok).toBe(true)
    expect(validarLoja(form({ latitude: '-12,9', longitude: '' })).ok).toBe(false)
    expect(validarLoja(form({ latitude: '91', longitude: '-38' })).ok).toBe(false)
    expect(validarLoja(form({ latitude: '-12', longitude: '-181' })).ok).toBe(false)
    expect(validarLoja(form({ latitude: 'abc', longitude: '-38' })).ok).toBe(false)
    const r = validarLoja(form({ latitude: '', longitude: '' }))
    expect(r.ok && [r.valor.latitude, r.valor.longitude]).toEqual([null, null])
  })

  it('horário: fechar precisa ser depois de abrir', () => {
    const r = validarLoja(form({ horarios: [{ dia: 5, abre: '22:00', fecha: '18:00' }] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros[0]).toMatch(/Sexta-feira.*depois do de abrir/)
    expect(validarLoja(form({ horarios: [{ dia: 5, abre: '18:00', fecha: '18:00' }] })).ok).toBe(
      false,
    )
  })

  it('horário incompleto ou mal formado é recusado', () => {
    expect(validarLoja(form({ horarios: [{ dia: 1, abre: '', fecha: '22:00' }] })).ok).toBe(false)
    expect(validarLoja(form({ horarios: [{ dia: 1, abre: '25:00', fecha: '26:00' }] })).ok).toBe(
      false,
    )
  })

  it('vários intervalos no mesmo dia são permitidos; sobreposição não', () => {
    const ok = validarLoja(
      form({
        horarios: [
          { dia: 6, abre: '18:00', fecha: '22:00' },
          { dia: 6, abre: '12:00', fecha: '15:00' },
        ],
      }),
    )
    expect(ok.ok && ok.valor.horarios.map((h) => h.abre)).toEqual(['12:00', '18:00'])

    const ruim = validarLoja(
      form({
        horarios: [
          { dia: 6, abre: '12:00', fecha: '19:00' },
          { dia: 6, abre: '18:00', fecha: '22:00' },
        ],
      }),
    )
    expect(ruim.ok).toBe(false)
    if (!ruim.ok) expect(ruim.erros[0]).toMatch(/Sábado.*se sobrepõem/)
  })

  it('intervalos que apenas se encostam (fecha 15:00, abre 15:00) são permitidos', () => {
    const r = validarLoja(
      form({
        horarios: [
          { dia: 6, abre: '12:00', fecha: '15:00' },
          { dia: 6, abre: '15:00', fecha: '18:00' },
        ],
      }),
    )
    expect(r.ok).toBe(true)
  })

  it('sem nenhum horário é válido (a loja só abre pelo modo manual)', () => {
    expect(validarLoja(form({ horarios: [] })).ok).toBe(true)
  })

  it('nome vazio é recusado', () => {
    expect(validarLoja(form({ nome: ' ' })).ok).toBe(false)
  })
})

describe('resumoDoDia', () => {
  it('resume os intervalos em ordem, ou "Fechado"', () => {
    const h = [
      { dia: 6, abre: '18:00', fecha: '22:00' },
      { dia: 6, abre: '12:00', fecha: '15:00' },
    ]
    expect(resumoDoDia(h, 6)).toBe('12:00–15:00, 18:00–22:00')
    expect(resumoDoDia(h, 1)).toBe('Fechado')
  })
})
