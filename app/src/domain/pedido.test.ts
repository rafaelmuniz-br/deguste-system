import { describe, expect, it, vi } from 'vitest'
import { cardapioExemplo } from '../data/exemplo.ts'
import {
  calcularPedido,
  lerEntrada,
  type CodigoErro,
  type ContextoPedido,
  type PedidoEntrada,
} from './pedido.ts'
import { montarLinhasDoBanco } from './pedidoBanco.ts'
import type { Cardapio } from './tipos.ts'

const ABERTA = new Date('2026-09-18T21:30:00Z') // sexta 18:30 na Bahia
const FECHADA = new Date('2026-09-18T20:00:00Z') // sexta 17:00 na Bahia

const clonar = (): Cardapio => structuredClone(cardapioExemplo)

function contexto(over: Partial<ContextoPedido> = {}, cardapio = clonar()): ContextoPedido {
  return {
    cardapio,
    agora: ABERTA,
    resolverDistanciaKm: vi.fn().mockResolvedValue(3.5),
    ...over,
  }
}

const entrada = (over: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  cliente: { nome: 'Maria Silva', telefone: '71999991234' },
  tipo: 'retirada',
  itens: [{ produtoId: 'beb-agua', quantidade: 1, escolhas: {} }],
  ...over,
})

const enderecoOk = { rua: 'Rua das Flores', numero: '10', bairro: 'Pituba' }

async function codigos(e: PedidoEntrada, ctx = contexto()): Promise<CodigoErro[]> {
  const r = await calcularPedido(e, ctx)
  return r.ok ? [] : r.erros.map((x) => x.codigo)
}

describe('lerEntrada (formato do que chega do navegador)', () => {
  const valida = {
    cliente: { nome: '  Maria Silva ', telefone: '(71) 99999-1234' },
    tipo: 'entrega',
    endereco: { rua: 'Rua A', numero: '1', bairro: 'Pituba' },
    itens: [
      { produtoId: 'beb-agua', quantidade: 2, escolhas: { g: ['a'] }, observacao: ' gelada ' },
    ],
    observacoes: 'tocar a campainha',
  }

  it('aceita, limpa espaços e normaliza o telefone', () => {
    const r = lerEntrada(valida)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.entrada.cliente).toEqual({ nome: 'Maria Silva', telefone: '71999991234' })
      expect(r.entrada.itens[0].observacao).toBe('gelada')
    }
  })

  it('descarta qualquer campo extra, inclusive preços e totais enviados pelo cliente', () => {
    const r = lerEntrada({
      ...valida,
      totalCentavos: 1,
      taxaEntregaCentavos: 0,
      itens: [{ ...valida.itens[0], precoUnitarioCentavos: 1, totalCentavos: 1 }],
    })
    expect(r.ok).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/totalCentavos|taxaEntrega|precoUnitario/)
  })

  it.each([
    ['null', null],
    ['texto', 'oi'],
    ['lista', []],
  ])('rejeita entrada %s', (_nome, bruto) => {
    expect(lerEntrada(bruto).ok).toBe(false)
  })

  it('exige nome e telefone válidos', () => {
    const r = lerEntrada({ ...valida, cliente: { nome: 'A', telefone: '123' } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros.map((e) => e.codigo)).toEqual(['NOME_INVALIDO', 'TELEFONE_INVALIDO'])
  })

  it('entrega exige rua, número e bairro; retirada dispensa endereço', () => {
    const semEndereco = lerEntrada({ ...valida, endereco: { rua: 'Rua A' } })
    expect(semEndereco.ok).toBe(false)
    expect(lerEntrada({ ...valida, tipo: 'retirada', endereco: undefined }).ok).toBe(true)
  })

  it('rejeita sacola vazia, quantidade não inteira e tipo desconhecido', () => {
    expect(lerEntrada({ ...valida, itens: [] }).ok).toBe(false)
    expect(lerEntrada({ ...valida, itens: [{ produtoId: 'x', quantidade: 1.5 }] }).ok).toBe(false)
    expect(lerEntrada({ ...valida, itens: [{ produtoId: 'x', quantidade: '2' }] }).ok).toBe(false)
    expect(lerEntrada({ ...valida, tipo: 'drone' }).ok).toBe(false)
  })

  it('rejeita escolhas malformadas e textos longos demais', () => {
    const item = { produtoId: 'x', quantidade: 1 }
    expect(lerEntrada({ ...valida, itens: [{ ...item, escolhas: { g: 'a' } }] }).ok).toBe(false)
    expect(lerEntrada({ ...valida, itens: [{ ...item, escolhas: { g: [1] } }] }).ok).toBe(false)
    expect(lerEntrada({ ...valida, itens: [{ ...item, observacao: 'x'.repeat(141) }] }).ok).toBe(
      false,
    )
    expect(lerEntrada({ ...valida, observacoes: 'x'.repeat(301) }).ok).toBe(false)
  })
})

describe('calcularPedido: preços calculados pelo servidor', () => {
  it('retirada simples: total = itens, sem frete e sem consultar rotas', async () => {
    const ctx = contexto()
    const r = await calcularPedido(entrada(), ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pedido).toMatchObject({
      subtotalCentavos: 400,
      taxaEntregaCentavos: 0,
      descontoCentavos: 0,
      totalCentavos: 400,
    })
    expect(ctx.resolverDistanciaKm).not.toHaveBeenCalled()
  })

  it('soma adicionais ao preço e multiplica pela quantidade', async () => {
    const r = await calcularPedido(
      entrada({
        itens: [
          {
            produtoId: 'smash-jackfino',
            quantidade: 2,
            escolhas: {
              'smash-jackfino-adicionais': ['smash-jackfino-bacon', 'smash-jackfino-ovo'],
            },
          },
        ],
      }),
      contexto(),
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pedido.itens[0].precoUnitarioCentavos).toBe(2199 + 400 + 250)
      expect(r.pedido.totalCentavos).toBe((2199 + 400 + 250) * 2)
    }
  })

  it('combo: registra o produto real escolhido em cada grupo, com a quantidade total', async () => {
    const r = await calcularPedido(
      entrada({
        itens: [
          {
            produtoId: 'combo-smash',
            quantidade: 2,
            escolhas: {
              'combo-smash-hamburguer': ['cs-xeque'],
              'combo-smash-bebida': ['cs-coca'],
            },
          },
        ],
      }),
      contexto(),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pedido.itens[0].totalCentavos).toBe((3999 + 400) * 2)
    expect(r.pedido.itens[0].componentes.map((c) => [c.produtoId, c.quantidade])).toEqual([
      ['smash-xeque-mate', 2],
      ['beb-coca', 2],
    ])
  })

  it('entrega por km: soma frete ao total e guarda a distância', async () => {
    const ctx = contexto()
    const r = await calcularPedido(entrada({ tipo: 'entrega', endereco: enderecoOk }), ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.pedido.taxaEntregaCentavos).toBe(500 + 525)
    expect(r.pedido.distanciaKm).toBe(3.5)
    expect(r.pedido.totalCentavos).toBe(400 + 1025)
    expect(ctx.resolverDistanciaKm).toHaveBeenCalledTimes(1)
  })

  it('entrega por bairro: não consulta serviço de rotas', async () => {
    const cardapio = clonar()
    cardapio.loja.entrega = {
      regra: { tipo: 'por_bairro', bairros: { pituba: 700 } },
      raioMaximoKm: 10,
    }
    const ctx = contexto({}, cardapio)
    const r = await calcularPedido(entrada({ tipo: 'entrega', endereco: enderecoOk }), ctx)
    expect(r.ok && r.pedido.taxaEntregaCentavos).toBe(700)
    expect(ctx.resolverDistanciaKm).not.toHaveBeenCalled()
  })
})

describe('calcularPedido: o que o servidor recusa', () => {
  it('loja fechada', async () => {
    const ctx = contexto({ agora: FECHADA })
    expect(await codigos(entrada(), ctx)).toContain('LOJA_FECHADA')
  })

  it('loja fechada não consulta o serviço de rotas (não gasta cota)', async () => {
    const ctx = contexto({ agora: FECHADA })
    await calcularPedido(entrada({ tipo: 'entrega', endereco: enderecoOk }), ctx)
    expect(ctx.resolverDistanciaKm).not.toHaveBeenCalled()
  })

  it('produto esgotado e produto que não existe', async () => {
    const e = entrada({
      itens: [
        { produtoId: 'ent-brownie', quantidade: 1, escolhas: {} },
        { produtoId: 'nao-existe', quantidade: 1, escolhas: {} },
      ],
    })
    expect(await codigos(e)).toEqual(['PRODUTO_INDISPONIVEL', 'PRODUTO_INEXISTENTE'])
  })

  it.each([0, -1, 21])('quantidade %i fora de 1..20', async (quantidade) => {
    const e = entrada({ itens: [{ produtoId: 'beb-agua', quantidade, escolhas: {} }] })
    expect(await codigos(e)).toEqual(['QUANTIDADE_INVALIDA'])
  })

  it('combo sem as escolhas obrigatórias', async () => {
    const e = entrada({ itens: [{ produtoId: 'combo-smash', quantidade: 1, escolhas: {} }] })
    expect(await codigos(e)).toEqual(['ESCOLHAS_INSUFICIENTES', 'ESCOLHAS_INSUFICIENTES'])
  })

  it('opção que não existe, opção esgotada, repetida ou em excesso', async () => {
    const g = 'smash-jackfino-adicionais'
    const item = (ids: string[]) =>
      entrada({ itens: [{ produtoId: 'smash-jackfino', quantidade: 1, escolhas: { [g]: ids } }] })
    expect(await codigos(item(['fantasma']))).toEqual(['ESCOLHA_INVALIDA'])
    expect(await codigos(item(['smash-jackfino-picles']))).toEqual(['OPCAO_INDISPONIVEL'])
    expect(await codigos(item(['smash-jackfino-bacon', 'smash-jackfino-bacon']))).toEqual([
      'ESCOLHA_INVALIDA',
    ])
    expect(
      await codigos(
        item([
          'smash-jackfino-bacon',
          'smash-jackfino-queijo',
          'smash-jackfino-ovo',
          'smash-jackfino-cebola',
        ]),
      ),
    ).toEqual(['ESCOLHAS_DEMAIS'])
  })

  it('grupo que não pertence ao produto', async () => {
    const e = entrada({
      itens: [{ produtoId: 'beb-agua', quantidade: 1, escolhas: { 'outro-grupo': ['x'] } }],
    })
    expect(await codigos(e)).toEqual(['ESCOLHA_INVALIDA'])
  })

  it('combo cujo produto escolhido está esgotado', async () => {
    const cardapio = clonar()
    const coca = cardapio.produtos.find((p) => p.id === 'beb-coca')
    if (coca) coca.disponivel = false
    const e = entrada({
      itens: [
        {
          produtoId: 'combo-smash',
          quantidade: 1,
          escolhas: {
            'combo-smash-hamburguer': ['cs-jackfino'],
            'combo-smash-bebida': ['cs-coca'],
          },
        },
      ],
    })
    expect(await codigos(e, contexto({}, cardapio))).toEqual([
      'OPCAO_INDISPONIVEL',
      'ESCOLHAS_INSUFICIENTES',
    ])
  })

  it('pedido abaixo do mínimo (o frete não conta para o mínimo)', async () => {
    const cardapio = clonar()
    cardapio.loja.pedidoMinimoCentavos = 3000
    expect(await codigos(entrada(), contexto({}, cardapio))).toEqual(['PEDIDO_MINIMO'])
    const e = entrada({ tipo: 'entrega', endereco: enderecoOk })
    expect(await codigos(e, contexto({}, cardapio))).toEqual(['PEDIDO_MINIMO'])
  })

  it('endereço fora do raio', async () => {
    const ctx = contexto({ resolverDistanciaKm: vi.fn().mockResolvedValue(9) })
    expect(await codigos(entrada({ tipo: 'entrega', endereco: enderecoOk }), ctx)).toEqual([
      'FORA_DA_AREA',
    ])
  })

  it('endereço que o serviço de rotas não encontrou', async () => {
    const ctx = contexto({ resolverDistanciaKm: vi.fn().mockResolvedValue(null) })
    expect(await codigos(entrada({ tipo: 'entrega', endereco: enderecoOk }), ctx)).toEqual([
      'DISTANCIA_INDISPONIVEL',
    ])
  })

  it('entrega sem endereço', async () => {
    expect(await codigos(entrada({ tipo: 'entrega' }))).toEqual(['ENDERECO_OBRIGATORIO'])
  })

  it('sacola vazia', async () => {
    expect(await codigos(entrada({ itens: [] }))).toEqual(['SACOLA_VAZIA'])
  })

  it('devolve todos os problemas de uma vez', async () => {
    const e = entrada({
      itens: [
        { produtoId: 'ent-brownie', quantidade: 1, escolhas: {} },
        { produtoId: 'beb-agua', quantidade: 99, escolhas: {} },
      ],
    })
    expect(await codigos(e, contexto({ agora: FECHADA }))).toEqual([
      'LOJA_FECHADA',
      'PRODUTO_INDISPONIVEL',
      'QUANTIDADE_INVALIDA',
    ])
  })
})

describe('montarLinhasDoBanco', () => {
  it('gera as linhas com chaves ligadas e totais coerentes', async () => {
    const r = await calcularPedido(
      entrada({
        tipo: 'entrega',
        endereco: { ...enderecoOk, complemento: 'apto 2' },
        itens: [
          {
            produtoId: 'combo-smash',
            quantidade: 2,
            escolhas: {
              'combo-smash-hamburguer': ['cs-jackfino'],
              'combo-smash-bebida': ['cs-coca'],
            },
            observacao: 'sem gelo',
          },
        ],
      }),
      contexto(),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    let n = 0
    const linhas = montarLinhasDoBanco(r.pedido, () => `id-${++n}`)

    expect(linhas.pedido).toMatchObject({
      id: 'id-1',
      canal: 'proprio',
      status: 'aguardando_pagamento',
      pagamento_status: 'pendente',
      cliente_telefone: '71999991234',
      endereco_complemento: 'apto 2',
      distancia_km: 3.5,
      subtotal_centavos: 3999 * 2,
      taxa_entrega_centavos: 1025,
      total_centavos: 3999 * 2 + 1025,
    })
    expect(linhas.itens).toHaveLength(1)
    expect(linhas.itens[0]).toMatchObject({
      pedido_id: 'id-1',
      produto_id: 'combo-smash',
      observacoes: 'sem gelo',
    })
    expect(linhas.componentes.map((c) => [c.item_pedido_id, c.produto_id, c.quantidade])).toEqual([
      ['id-2', 'smash-jackfino', 2],
      ['id-2', 'beb-coca', 2],
    ])
    // invariante que o banco também impõe
    expect(linhas.pedido.total_centavos).toBe(
      linhas.pedido.subtotal_centavos +
        linhas.pedido.taxa_entrega_centavos -
        linhas.pedido.desconto_centavos,
    )
  })

  it('retirada não tem endereço nem distância', async () => {
    const r = await calcularPedido(entrada(), contexto())
    if (!r.ok) throw new Error('esperava pedido válido')
    const { pedido } = montarLinhasDoBanco(r.pedido)
    expect(pedido.endereco_rua).toBeNull()
    expect(pedido.distancia_km).toBeNull()
  })
})
