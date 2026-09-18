import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PedidoEntrada } from '../../app/src/domain/pedido.ts'
import { calcularPedido } from '../../app/src/domain/pedido.ts'
import { montarLinhasDoBanco } from '../../app/src/domain/pedidoBanco.ts'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { criarBanco } from './helpers.ts'

// Teste de CONTRATO: o que o código do app (calcularPedido + montarLinhasDoBanco) produz tem
// que ser aceito pelo schema real (tipos, checks, chaves estrangeiras). Usa os mesmos ids do seed.

const SMASH = '00000000-0000-4000-8001-000000000001'
const REFRI = '00000000-0000-4000-8001-000000000003'
const COMBO = '00000000-0000-4000-8001-000000000004'
const CAT = '00000000-0000-4000-8000-000000000001'

const cardapio: Cardapio = {
  categorias: [{ id: CAT, nome: 'Ofertas', ordem: 1 }],
  produtos: [
    { id: SMASH, categoriaId: CAT, nome: 'Smash Exemplo', precoCentavos: 2199, ehCombo: false, disponivel: true, grupos: [] },
    { id: REFRI, categoriaId: CAT, nome: 'Refrigerante Exemplo', precoCentavos: 700, ehCombo: false, disponivel: true, grupos: [] },
    {
      id: COMBO,
      categoriaId: CAT,
      nome: 'Combo Exemplo',
      precoCentavos: 3999,
      ehCombo: true,
      disponivel: true,
      grupos: [
        {
          id: 'g-ham',
          nome: 'Escolha seu hambúrguer',
          minEscolhas: 1,
          maxEscolhas: 1,
          opcoes: [{ id: 'o-smash', nome: 'Smash Exemplo', precoAdicionalCentavos: 0, produtoId: SMASH, disponivel: true }],
        },
      ],
    },
  ],
  loja: {
    nome: 'Deguste Burguer',
    fusoHorario: 'America/Bahia',
    modo: 'forcar_aberta',
    pedidoMinimoCentavos: 0,
    tempoPreparoMin: 30,
    horarios: [],
    entrega: { regra: { tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 }, raioMaximoKm: 6 },
  },
}

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

async function inserir(tabela: string, linha: Record<string, unknown>) {
  const colunas = Object.keys(linha)
  const marcadores = colunas.map((_, i) => `$${i + 1}`).join(', ')
  await db.query(
    `insert into public.${tabela} (${colunas.join(', ')}) values (${marcadores})`,
    colunas.map((c) => linha[c]),
  )
}

async function gravar(entrada: PedidoEntrada) {
  const r = await calcularPedido(entrada, {
    cardapio,
    agora: new Date(),
    resolverDistanciaKm: async () => 2.4,
  })
  if (!r.ok) throw new Error(`pedido recusado: ${JSON.stringify(r.erros)}`)
  const linhas = montarLinhasDoBanco(r.pedido)
  await inserir('pedidos', linhas.pedido)
  for (const item of linhas.itens) await inserir('itens_pedido', item)
  for (const comp of linhas.componentes) await inserir('itens_pedido_componentes', comp)
  return linhas
}

describe('contrato app x banco', () => {
  it('pedido de entrega com combo é aceito pelo schema e guarda o produto real escolhido', async () => {
    const linhas = await gravar({
      cliente: { nome: 'Maria Silva', telefone: '71999991234' },
      tipo: 'entrega',
      endereco: { rua: 'Rua das Flores', numero: '10', bairro: 'Pituba', complemento: 'apto 2' },
      itens: [
        { produtoId: COMBO, quantidade: 2, escolhas: { 'g-ham': ['o-smash'] }, observacao: 'sem cebola' },
        { produtoId: REFRI, quantidade: 1, escolhas: {} },
      ],
    })

    const { rows: pedido } = await db.query<{
      total_centavos: number
      status: string
      distancia_km: string
    }>(`select total_centavos, status, distancia_km from public.pedidos where id = $1`, [linhas.pedido.id])
    // (3999 x 2) + 700 = 8698 de itens; frete: 500 + round(150 x 2.4) = 860
    expect(pedido[0].total_centavos).toBe(8698 + 860)
    expect(pedido[0].status).toBe('aguardando_pagamento')
    expect(Number(pedido[0].distancia_km)).toBe(2.4)

    // O relatório por produto real enxerga o Smash vendido dentro do combo.
    const { rows: vendas } = await db.query<{ unidades: number }>(
      `select sum(quantidade)::int as unidades from public.itens_pedido_componentes where produto_id = $1`,
      [SMASH],
    )
    expect(vendas[0].unidades).toBe(2)
  })

  it('pedido de retirada (sem endereço) também é aceito', async () => {
    const linhas = await gravar({
      cliente: { nome: 'João Souza', telefone: '71988887777' },
      tipo: 'retirada',
      itens: [{ produtoId: SMASH, quantidade: 3, escolhas: {} }],
    })
    const { rows } = await db.query<{ endereco_rua: string | null; total_centavos: number }>(
      `select endereco_rua, total_centavos from public.pedidos where id = $1`,
      [linhas.pedido.id],
    )
    expect(rows[0]).toEqual({ endereco_rua: null, total_centavos: 2199 * 3 })
  })
})
