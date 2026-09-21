import { describe, expect, it } from 'vitest'
import { descreverRegra, validarGrupo, validarOpcao } from './adminOpcoes.ts'

describe('validarGrupo', () => {
  it('aceita e converte números', () => {
    expect(validarGrupo({ nome: ' Ponto da carne ', minEscolhas: '1', maxEscolhas: '1' })).toEqual({
      ok: true,
      valor: { nome: 'Ponto da carne', minEscolhas: 1, maxEscolhas: 1 },
    })
    expect(validarGrupo({ nome: 'Adicionais', minEscolhas: '0', maxEscolhas: '5' }).ok).toBe(true)
  })

  it('mínimo maior que máximo é recusado', () => {
    const r = validarGrupo({ nome: 'X', minEscolhas: '3', maxEscolhas: '2' })
    // nome "X" tem 1 letra: também é erro; o de mínimo/máximo precisa aparecer junto
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros.join(' ')).toMatch(/mínimo de escolhas não pode ser maior/)
  })

  it('máximo precisa ser 1 ou mais; campos não numéricos são recusados', () => {
    expect(validarGrupo({ nome: 'Grupo', minEscolhas: '0', maxEscolhas: '0' }).ok).toBe(false)
    expect(validarGrupo({ nome: 'Grupo', minEscolhas: '', maxEscolhas: '1' }).ok).toBe(false)
    expect(validarGrupo({ nome: 'Grupo', minEscolhas: '1', maxEscolhas: 'x' }).ok).toBe(false)
    expect(validarGrupo({ nome: 'Grupo', minEscolhas: '-1', maxEscolhas: '1' }).ok).toBe(false)
    expect(validarGrupo({ nome: 'Grupo', minEscolhas: '1,5', maxEscolhas: '2' }).ok).toBe(false)
  })

  it('nome curto ou longo demais', () => {
    expect(validarGrupo({ nome: '', minEscolhas: '0', maxEscolhas: '1' }).ok).toBe(false)
    expect(validarGrupo({ nome: 'a'.repeat(61), minEscolhas: '0', maxEscolhas: '1' }).ok).toBe(
      false,
    )
  })
})

describe('validarOpcao', () => {
  it('valor adicional em reais vira centavos; em branco = sem custo', () => {
    expect(validarOpcao({ nome: 'Bacon', precoAdicional: '3,50', produtoId: '' })).toEqual({
      ok: true,
      valor: { nome: 'Bacon', precoAdicionalCentavos: 350, produtoId: null },
    })
    const r = validarOpcao({ nome: 'Sem cebola', precoAdicional: '', produtoId: '' })
    expect(r.ok && r.valor.precoAdicionalCentavos).toBe(0)
  })

  it('opção de combo aponta para um produto real', () => {
    const r = validarOpcao({ nome: 'Smash', precoAdicional: '0', produtoId: 'p-smash' })
    expect(r.ok && r.valor.produtoId).toBe('p-smash')
  })

  it('recusa nome vazio e valor inválido (junta os dois erros)', () => {
    const r = validarOpcao({ nome: ' ', precoAdicional: 'abc', produtoId: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros).toHaveLength(2)
    expect(validarOpcao({ nome: 'X', precoAdicional: '-2', produtoId: '' }).ok).toBe(false)
  })
})

describe('descreverRegra', () => {
  it.each([
    [1, 1, 'Obrigatório: escolha 1'],
    [2, 2, 'Obrigatório: escolha 2'],
    [1, 3, 'Obrigatório: escolha de 1 a 3'],
    [0, 1, 'Opcional (escolha 1)'],
    [0, 4, 'Opcional, até 4'],
  ])('mín %i / máx %i → %s', (min, max, texto) => {
    expect(descreverRegra(min, max)).toBe(texto)
  })
})
