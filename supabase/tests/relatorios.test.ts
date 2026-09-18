import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anon, clienteLogado, como, criarBanco } from './helpers.ts'

const SMASH = '00000000-0000-4000-8001-000000000001'
const BURGUER = '00000000-0000-4000-8001-000000000002'
const REFRI = '00000000-0000-4000-8001-000000000003'
const COMBO = '00000000-0000-4000-8001-000000000004'

let db: PGlite

type Relatorio = {
  periodo: { inicio: string; fim: string }
  resumo: { pedidos: number; receita_centavos: number; ticket_medio_centavos: number; cancelados: number }
  por_dia: { dia: string; pedidos: number; receita_centavos: number }[]
  por_canal: { canal: string; pedidos: number; receita_centavos: number }[]
  por_tipo: { tipo: string; pedidos: number; receita_centavos: number }[]
  por_hora: { hora: number; pedidos: number }[]
  produtos: {
    produto_id: string
    nome: string
    unidades: number
    unidades_em_combo: number
    receita_avulsa_centavos: number
  }[]
}

let contador = 0

/** Cria um pedido com itens direto no banco (superusuário), com data/status/canal à escolha. */
async function pedido(o: {
  quando: string
  total: number
  canal?: string
  tipo?: 'entrega' | 'retirada'
  status?: string
  pagamento?: string
  itens: { produto: string; qtd: number; total: number; escolhas?: { produto: string; qtd?: number }[] }[]
}) {
  contador++
  const status = o.status ?? 'concluido'
  const tipo = o.tipo ?? 'retirada'
  const { rows } = await db.query<{ id: string }>(
    `insert into public.pedidos
       (canal, cliente_nome, cliente_telefone, tipo, status, pagamento_status, endereco_rua,
        subtotal_centavos, total_centavos, motivo_cancelamento, created_at)
     values ($1, 'Cliente', '71999990000', $2, $3, $4, $5, $6, $6, $7, $8)
     returning id`,
    [
      o.canal ?? 'proprio',
      tipo,
      status,
      o.pagamento ?? 'pago',
      tipo === 'entrega' ? 'Rua A' : null,
      o.total,
      status === 'cancelado' ? 'teste' : null,
      o.quando,
    ],
  )
  for (const item of o.itens) {
    const r = await db.query<{ id: string }>(
      `insert into public.itens_pedido (pedido_id, produto_id, nome, quantidade, preco_unitario_centavos, total_centavos)
       values ($1, $2, 'x', $3, $4, $4) returning id`,
      [rows[0].id, item.produto, item.qtd, item.total],
    )
    for (const e of item.escolhas ?? []) {
      await db.query(
        `insert into public.itens_pedido_componentes (item_pedido_id, produto_id, grupo_nome, opcao_nome, quantidade)
         values ($1, $2, 'Escolha seu hambúrguer', 'x', $3)`,
        [r.rows[0].id, e.produto, e.qtd ?? 1],
      )
    }
  }
  return rows[0].id
}

const relatorio = (papel: typeof admin, inicio: string, fim: string) =>
  como(db, papel, async () => {
    const r = await db.query<{ relatorio_vendas: Relatorio }>(`select public.relatorio_vendas($1::date, $2::date)`, [
      inicio,
      fim,
    ])
    return r.rows[0].relatorio_vendas
  })

beforeAll(async () => {
  db = await criarBanco()

  // Dia 10/09 (horário da Bahia, UTC-3)
  await pedido({ quando: '2026-09-10 19:10:00-03', total: 2199, itens: [{ produto: SMASH, qtd: 1, total: 2199 }] })
  await pedido({
    quando: '2026-09-10 20:30:00-03',
    total: 3999,
    canal: 'ifood',
    tipo: 'entrega',
    itens: [{ produto: COMBO, qtd: 1, total: 3999, escolhas: [{ produto: BURGUER }, { produto: REFRI }] }],
  })
  // 22:30 na Bahia = 01:30 UTC do dia 11: precisa contar no dia 10 (fuso), não no 11
  await pedido({
    quando: '2026-09-11 01:30:00+00',
    total: 4398,
    itens: [{ produto: SMASH, qtd: 2, total: 4398 }],
  })
  // Dia 11/09
  await pedido({
    quando: '2026-09-11 19:00:00-03',
    total: 3399,
    itens: [{ produto: BURGUER, qtd: 1, total: 3399 }],
  })
  // Não são vendas: cancelado, não pago, pendente
  await pedido({ quando: '2026-09-11 19:30:00-03', total: 9999, status: 'cancelado', itens: [{ produto: SMASH, qtd: 9, total: 9999 }] })
  await pedido({ quando: '2026-09-11 20:00:00-03', total: 8888, status: 'aguardando_pagamento', pagamento: 'pendente', itens: [{ produto: SMASH, qtd: 8, total: 8888 }] })
  // Fora do período (dia 12)
  await pedido({ quando: '2026-09-12 19:00:00-03', total: 7777, itens: [{ produto: SMASH, qtd: 7, total: 7777 }] })
}, 60_000)

afterAll(async () => {
  await db.close()
})

describe('relatorio_vendas (6.2)', () => {
  it('resumo: só pedidos pagos e não cancelados; cancelados contados à parte', async () => {
    const r = await relatorio(admin, '2026-09-10', '2026-09-11')
    expect(r.resumo.pedidos).toBe(4)
    expect(r.resumo.receita_centavos).toBe(2199 + 3999 + 4398 + 3399)
    expect(r.resumo.ticket_medio_centavos).toBe(Math.round((2199 + 3999 + 4398 + 3399) / 4))
    expect(r.resumo.cancelados).toBe(1)
  })

  it('por dia no FUSO DA BAHIA (pedido às 22:30 locais, que já é dia 11 em UTC, fica no dia 10)', async () => {
    const r = await relatorio(admin, '2026-09-10', '2026-09-11')
    expect(r.por_dia).toEqual([
      { dia: '2026-09-10', pedidos: 3, receita_centavos: 2199 + 3999 + 4398 },
      { dia: '2026-09-11', pedidos: 1, receita_centavos: 3399 },
    ])
  })

  it('período de um dia só e período sem vendas', async () => {
    const um = await relatorio(admin, '2026-09-11', '2026-09-11')
    expect(um.resumo.pedidos).toBe(1)
    const vazio = await relatorio(admin, '2026-01-01', '2026-01-31')
    expect(vazio.resumo).toEqual({ pedidos: 0, receita_centavos: 0, ticket_medio_centavos: 0, cancelados: 0 })
    expect(vazio.por_dia).toEqual([])
    expect(vazio.produtos).toEqual([])
  })

  it('por canal e por tipo', async () => {
    const r = await relatorio(admin, '2026-09-10', '2026-09-11')
    expect(r.por_canal).toEqual([
      { canal: 'proprio', pedidos: 3, receita_centavos: 2199 + 4398 + 3399 },
      { canal: 'ifood', pedidos: 1, receita_centavos: 3999 },
    ])
    expect(r.por_tipo.find((t) => t.tipo === 'entrega')).toEqual({ tipo: 'entrega', pedidos: 1, receita_centavos: 3999 })
    expect(r.por_tipo.find((t) => t.tipo === 'retirada')?.pedidos).toBe(3)
  })

  it('horário de pico: hora local da Bahia', async () => {
    const r = await relatorio(admin, '2026-09-10', '2026-09-11')
    expect(r.por_hora).toEqual([
      { hora: 19, pedidos: 2 }, // 19:10 (dia 10) e 19:00 (dia 11)
      { hora: 20, pedidos: 1 },
      { hora: 22, pedidos: 1 }, // 01:30 UTC = 22:30 Bahia
    ])
  })

  it('produtos pelo produto_id REAL: o hambúrguer dentro do combo soma com o vendido avulso', async () => {
    const r = await relatorio(admin, '2026-09-10', '2026-09-11')
    const por = Object.fromEntries(r.produtos.map((p) => [p.produto_id, p]))

    // Smash: 1 + 2 avulsos, com receita
    expect(por[SMASH]).toMatchObject({ unidades: 3, unidades_em_combo: 0, receita_avulsa_centavos: 2199 + 4398 })
    // Burguer: 1 avulso + 1 escolhido no combo = 2 unidades, receita só do avulso
    expect(por[BURGUER]).toMatchObject({ unidades: 2, unidades_em_combo: 1, receita_avulsa_centavos: 3399 })
    // Refrigerante só aparece dentro do combo
    expect(por[REFRI]).toMatchObject({ unidades: 1, unidades_em_combo: 1, receita_avulsa_centavos: 0 })
    // O combo em si conta como unidade, mas sem receita "por produto"
    expect(por[COMBO]).toMatchObject({ unidades: 1, unidades_em_combo: 0, receita_avulsa_centavos: 0 })
    // Ordenado do mais vendido para o menos vendido
    expect(r.produtos[0].produto_id).toBe(SMASH)
    // Nada de pedido cancelado/pendente/fora do período
    expect(r.produtos.reduce((s, p) => s + p.unidades, 0)).toBe(3 + 2 + 1 + 1)
  })

  it('quantidade do combo multiplica as escolhas', async () => {
    await pedido({
      quando: '2026-10-05 19:00:00-03',
      total: 7998,
      itens: [{ produto: COMBO, qtd: 2, total: 7998, escolhas: [{ produto: BURGUER, qtd: 1 }] }],
    })
    const r = await relatorio(admin, '2026-10-05', '2026-10-05')
    const burguer = r.produtos.find((p) => p.produto_id === BURGUER)
    expect(burguer).toMatchObject({ unidades: 2, unidades_em_combo: 2 })
  })

  it('período inválido ou longo demais é recusado', async () => {
    await expect(relatorio(admin, '2026-09-11', '2026-09-10')).rejects.toThrow(/periodo_invalido/)
    await expect(relatorio(admin, '2024-01-01', '2026-01-01')).rejects.toThrow(/periodo_longo_demais/)
  })

  it('só admin: anônimo e cliente logado não enxergam vendas', async () => {
    await expect(relatorio(anon as typeof admin, '2026-09-10', '2026-09-11')).rejects.toThrow()
    await expect(relatorio(clienteLogado, '2026-09-10', '2026-09-11')).rejects.toThrow(/sem_permissao/)
  })
})
