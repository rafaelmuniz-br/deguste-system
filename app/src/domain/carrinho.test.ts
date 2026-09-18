import { describe, expect, it } from 'vitest'
import { cardapioExemplo } from '../data/exemplo.ts'
import { combinaComBusca } from './busca.ts'
import {
  carrinhoReducer,
  precoUnitario,
  QUANTIDADE_MAXIMA,
  resolverCarrinho,
  subtotal,
  validarEscolhas,
  type LinhaCarrinho,
} from './carrinho.ts'
import { formatarPreco } from './dinheiro.ts'

const produto = (id: string) => {
  const p = cardapioExemplo.produtos.find((x) => x.id === id)
  if (!p) throw new Error(`produto ${id} não existe no exemplo`)
  return p
}

const linha = (over: Partial<LinhaCarrinho> = {}): LinhaCarrinho => ({
  id: 'l1',
  produtoId: 'smash-jackfino',
  quantidade: 1,
  escolhas: {},
  observacao: '',
  ...over,
})

const ADIC = 'smash-jackfino-adicionais'

describe('dinheiro', () => {
  it('formata centavos em reais', () => {
    expect(formatarPreco(2199).replace(/\s/g, ' ')).toBe('R$ 21,99')
    expect(formatarPreco(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
})

describe('precoUnitario', () => {
  it('soma os adicionais escolhidos ao preço base (em centavos)', () => {
    const p = produto('smash-jackfino')
    expect(precoUnitario(p, {})).toBe(2199)
    expect(precoUnitario(p, { [ADIC]: ['smash-jackfino-bacon', 'smash-jackfino-ovo'] })).toBe(
      2199 + 400 + 250,
    )
  })

  it('ignora ids de opção que não existem', () => {
    expect(precoUnitario(produto('smash-jackfino'), { [ADIC]: ['fantasma'] })).toBe(2199)
  })
})

describe('validarEscolhas', () => {
  it('exige as escolhas obrigatórias do combo', () => {
    const combo = produto('combo-smash')
    expect(validarEscolhas(combo, {})).toHaveLength(2)
    expect(
      validarEscolhas(combo, {
        'combo-smash-hamburguer': ['cs-jackfino'],
        'combo-smash-bebida': ['cs-coca'],
      }),
    ).toEqual([])
  })

  it('rejeita mais escolhas que o máximo do grupo', () => {
    const p = produto('smash-jackfino')
    const erros = validarEscolhas(p, {
      [ADIC]: ['smash-jackfino-bacon', 'smash-jackfino-queijo', 'smash-jackfino-ovo'],
    })
    expect(erros).toEqual([]) // 3 é o máximo permitido
    const muitas = validarEscolhas(
      { ...p, grupos: [{ ...p.grupos[0], maxEscolhas: 2 }] },
      { [ADIC]: ['smash-jackfino-bacon', 'smash-jackfino-queijo', 'smash-jackfino-ovo'] },
    )
    expect(muitas).toEqual(['"Adicionais" aceita no máximo 2'])
  })

  it('opção esgotada não conta como escolha válida', () => {
    const combo = produto('combo-smash')
    const p = {
      ...combo,
      grupos: [
        {
          ...combo.grupos[0],
          opcoes: combo.grupos[0].opcoes.map((o) => ({ ...o, disponivel: false })),
        },
      ],
    }
    expect(validarEscolhas(p, { 'combo-smash-hamburguer': ['cs-jackfino'] })).toHaveLength(1)
  })

  it('produto sem grupos é sempre válido', () => {
    expect(validarEscolhas(produto('beb-coca'), {})).toEqual([])
  })
})

describe('carrinhoReducer', () => {
  it('soma quantidade quando produto, escolhas e observação são iguais (ordem das escolhas não importa)', () => {
    const a = linha({ escolhas: { g: ['x', 'y'] } })
    const b = linha({ id: 'l2', escolhas: { g: ['y', 'x'] } })
    const r = carrinhoReducer(carrinhoReducer([], { tipo: 'adicionar', linha: a }), {
      tipo: 'adicionar',
      linha: b,
    })
    expect(r).toHaveLength(1)
    expect(r[0].quantidade).toBe(2)
  })

  it('cria linhas separadas quando as escolhas ou a observação diferem', () => {
    let r = carrinhoReducer([], { tipo: 'adicionar', linha: linha() })
    r = carrinhoReducer(r, {
      tipo: 'adicionar',
      linha: linha({ id: 'l2', observacao: 'sem cebola' }),
    })
    expect(r).toHaveLength(2)
  })

  it('respeita a quantidade máxima', () => {
    let r = carrinhoReducer([], {
      tipo: 'adicionar',
      linha: linha({ quantidade: QUANTIDADE_MAXIMA }),
    })
    r = carrinhoReducer(r, { tipo: 'adicionar', linha: linha({ id: 'l2', quantidade: 5 }) })
    expect(r[0].quantidade).toBe(QUANTIDADE_MAXIMA)
  })

  it('quantidade 0 remove a linha; remover e limpar funcionam', () => {
    const base = [linha(), linha({ id: 'l2', produtoId: 'beb-coca' })]
    expect(carrinhoReducer(base, { tipo: 'quantidade', id: 'l1', quantidade: 0 })).toHaveLength(1)
    expect(carrinhoReducer(base, { tipo: 'remover', id: 'l2' })).toHaveLength(1)
    expect(carrinhoReducer(base, { tipo: 'limpar' })).toEqual([])
  })
})

describe('resolverCarrinho e subtotal', () => {
  it('calcula total por linha e subtotal; descarta produto que saiu do cardápio', () => {
    const linhas = resolverCarrinho(cardapioExemplo, [
      linha({ quantidade: 2 }),
      linha({ id: 'l2', produtoId: 'beb-coca', quantidade: 1 }),
      linha({ id: 'l3', produtoId: 'produto-removido' }),
    ])
    expect(linhas).toHaveLength(2)
    expect(subtotal(linhas)).toBe(2199 * 2 + 600)
  })

  it('descreve as escolhas do combo em texto', () => {
    const [l] = resolverCarrinho(cardapioExemplo, [
      linha({
        produtoId: 'combo-smash',
        escolhas: { 'combo-smash-hamburguer': ['cs-xeque'], 'combo-smash-bebida': ['cs-coca'] },
      }),
    ])
    expect(l.resumoEscolhas).toEqual([
      'Escolha seu smash: Xeque Mate',
      'Escolha a bebida: Coca-Cola lata',
    ])
    expect(l.precoUnitarioCentavos).toBe(3999 + 400)
  })
})

describe('combos apontam para produtos reais (base para relatórios corretos)', () => {
  it('toda opção com produtoId referencia um produto existente no cardápio', () => {
    const ids = new Set(cardapioExemplo.produtos.map((p) => p.id))
    for (const p of cardapioExemplo.produtos) {
      for (const g of p.grupos) {
        for (const o of g.opcoes) {
          if (o.produtoId) expect(ids.has(o.produtoId)).toBe(true)
        }
      }
    }
  })
})

describe('combinaComBusca', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(combinaComBusca('boladao', 'Boladão')).toBe(true)
    expect(combinaComBusca('COCA', 'Coca-Cola lata')).toBe(true)
    expect(combinaComBusca('pizza', 'Jackfino', 'Smash 90g')).toBe(false)
    expect(combinaComBusca('', 'qualquer')).toBe(true)
  })
})
