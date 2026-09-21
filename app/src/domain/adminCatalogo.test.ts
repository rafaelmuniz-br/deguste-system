import { describe, expect, it } from 'vitest'
import {
  centavosParaReais,
  moverNaLista,
  reaisParaCentavos,
  validarCategoria,
  validarProduto,
  type FormProduto,
} from './adminCatalogo.ts'

describe('reaisParaCentavos', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['R$ 12,50', 1250],
    ['r$12,90', 1290],
    ['0,99', 99],
    ['0', 0],
    ['1.234,56', 123456],
    ['1.234', 123400], // ponto seguido de 3 dígitos = milhar
    [' 21,90 ', 2190],
  ])('%s → %i centavos', (entrada, esperado) => {
    expect(reaisParaCentavos(entrada)).toBe(esperado)
  })

  it.each(['', '   ', 'abc', '-5', '12,345', '12,,5', '1,2,3', 'R$', '12a', '99999999'])(
    'recusa "%s"',
    (entrada) => {
      expect(reaisParaCentavos(entrada)).toBeNull()
    },
  )

  it('vai e volta sem perder centavo (nada de float)', () => {
    for (const c of [0, 1, 99, 100, 1999, 2190, 123456]) {
      expect(reaisParaCentavos(centavosParaReais(c))).toBe(c)
    }
    expect(centavosParaReais(2190)).toBe('21,90')
  })
})

describe('validarCategoria', () => {
  it('aceita e limpa espaços; descrição vazia vira null', () => {
    expect(validarCategoria({ nome: '  Hambúrgueres ', descricao: ' ', ativo: true })).toEqual({
      ok: true,
      valor: { nome: 'Hambúrgueres', descricao: null, ativo: true },
    })
  })

  it('recusa nome curto ou longo demais', () => {
    expect(validarCategoria({ nome: 'A', descricao: '', ativo: true }).ok).toBe(false)
    expect(validarCategoria({ nome: 'x'.repeat(61), descricao: '', ativo: true }).ok).toBe(false)
  })
})

const produtoValido: FormProduto = {
  categoriaId: 'c1',
  nome: 'Jackfino',
  descricao: 'Pão, carne e queijo',
  preco: '21,90',
  precoOriginal: '',
  ehCombo: false,
  ativo: true,
}

describe('validarProduto', () => {
  it('converte o preço em centavos e limpa os campos', () => {
    expect(validarProduto({ ...produtoValido, nome: ' Jackfino ', descricao: '' })).toEqual({
      ok: true,
      valor: {
        categoriaId: 'c1',
        nome: 'Jackfino',
        descricao: null,
        precoCentavos: 2190,
        precoOriginalCentavos: null,
        ehCombo: false,
        ativo: true,
      },
    })
  })

  it('aceita preço grátis (R$ 0) — brinde/adicional sem custo', () => {
    const r = validarProduto({ ...produtoValido, preco: '0' })
    expect(r.ok && r.valor.precoCentavos).toBe(0)
  })

  it('preço "de" precisa ser MAIOR que o preço atual', () => {
    const r = validarProduto({ ...produtoValido, precoOriginal: '21,90' })
    expect(r.ok).toBe(false)
    const ok = validarProduto({ ...produtoValido, precoOriginal: '25,90' })
    expect(ok.ok && ok.valor.precoOriginalCentavos).toBe(2590)
  })

  it('junta todos os erros de uma vez (a pessoa corrige tudo numa passada)', () => {
    const r = validarProduto({
      ...produtoValido,
      categoriaId: '',
      nome: '',
      preco: 'abc',
      precoOriginal: 'xx',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros).toHaveLength(4)
  })
})

describe('moverNaLista', () => {
  it('troca com o vizinho', () => {
    expect(moverNaLista(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moverNaLista(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('na ponta ou id desconhecido: nada a fazer', () => {
    expect(moverNaLista(['a', 'b'], 'a', -1)).toBeNull()
    expect(moverNaLista(['a', 'b'], 'b', 1)).toBeNull()
    expect(moverNaLista(['a', 'b'], 'x', 1)).toBeNull()
  })
})
