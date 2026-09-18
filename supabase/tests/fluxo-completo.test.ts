import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarHandler } from '../../app/src/server/pedidosHandler.ts'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { anon, como, criarBanco, servico } from './helpers.ts'

// FLUXO COMPLETO: a função do servidor de verdade (validação, cálculo, gravação) falando com o banco
// de verdade (todas as migrations, RLS e funções), via PGlite. Só a rede e o serviço de rotas são
// simulados. Cobre pedido -> acompanhamento -> cozinha. Pagamento (Pix) entra com as tarefas 3.8/3.9.

const SMASH = '00000000-0000-4000-8001-000000000001'
const BURGUER = '00000000-0000-4000-8001-000000000002'
const REFRI = '00000000-0000-4000-8001-000000000003'
const COMBO = '00000000-0000-4000-8001-000000000004'
const CAT = '00000000-0000-4000-8000-000000000001'

const cardapio: Cardapio = {
  categorias: [{ id: CAT, nome: 'Ofertas', ordem: 1 }],
  produtos: [
    { id: SMASH, categoriaId: CAT, nome: 'Smash', precoCentavos: 2199, ehCombo: false, disponivel: true, grupos: [] },
    { id: BURGUER, categoriaId: CAT, nome: 'Burguer', precoCentavos: 3399, ehCombo: false, disponivel: true, grupos: [] },
    { id: REFRI, categoriaId: CAT, nome: 'Refri', precoCentavos: 700, ehCombo: false, disponivel: true, grupos: [] },
    {
      id: COMBO,
      categoriaId: CAT,
      nome: 'Combo 3 lanches',
      precoCentavos: 5000,
      ehCombo: true,
      disponivel: true,
      grupos: [
        {
          id: 'g-lanches',
          nome: 'Escolha 3 lanches',
          minEscolhas: 3,
          maxEscolhas: 3,
          opcoes: [
            { id: 'o-smash', nome: 'Smash', precoAdicionalCentavos: 0, produtoId: SMASH, disponivel: true },
            { id: 'o-burguer', nome: 'Burguer', precoAdicionalCentavos: 400, produtoId: BURGUER, disponivel: true },
          ],
        },
      ],
    },
  ],
  loja: {
    nome: 'Deguste Burguer',
    fusoHorario: 'America/Bahia',
    modo: 'automatico',
    pedidoMinimoCentavos: 0,
    tempoPreparoMin: 30,
    horarios: [3, 4, 5, 6, 0].map((diaSemana) => ({ diaSemana, abre: '18:00', fecha: '22:00' })),
    entrega: { regra: { tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 }, raioMaximoKm: 6 },
  },
}

let db: PGlite
let agora = new Date('2026-09-18T21:30:00Z') // sexta 18:30 na Bahia: aberta

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

const handler = () =>
  criarHandler({
    carregarCardapio: async () => cardapio,
    distanciaKm: async () => 2,
    agora: () => agora,
    // as mesmas chamadas que a função real faz ao Supabase: RPC criar_pedido com a service role
    criarPedidoNoBanco: async (linhas) => {
      const { rows } = await como(db, servico, () =>
        db.query<{ o_numero: string; o_token: string }>(`select * from public.criar_pedido($1::jsonb)`, [JSON.stringify(linhas)]),
      )
      return { numero: Number(rows[0].o_numero), token: rows[0].o_token }
    },
    limitarConfirmar: () => true, // o limite por IP tem teste próprio; aqui testamos o do banco
  })

const chamar = (acao: 'calcular' | 'confirmar', pedido: unknown) =>
  handler()(
    new Request('https://loja.test/.netlify/functions/pedidos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ acao, pedido }),
    }),
  )

const pedidoBase = (telefone: string) => ({
  cliente: { nome: 'Maria Silva', telefone },
  tipo: 'entrega',
  endereco: { rua: 'Rua das Flores', numero: '10', bairro: 'Pituba' },
  itens: [{ produtoId: REFRI, quantidade: 2, escolhas: {} }],
})

const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n)

describe('pedido de ponta a ponta', () => {
  it('confirmar grava no banco, devolve o token e o cliente acompanha até a cozinha andar', async () => {
    const r = await chamar('confirmar', pedidoBase('71966660001'))
    const corpo = (await r.json()) as { ok: boolean; numero: number; token: string; pedido: { totalCentavos: number } }
    expect(r.status).toBe(200)
    // 2 refris (1400) + frete 500 + 150 x 2 km = 2200
    expect(corpo.pedido.totalCentavos).toBe(1400 + 800)

    // gravado no banco, com o status inicial certo
    const { rows } = await db.query<{ status: string; pagamento_status: string; total_centavos: number; canal: string }>(
      `select status, pagamento_status, total_centavos, canal from public.pedidos where token_acompanhamento = $1`, [corpo.token])
    expect(rows[0]).toEqual({ status: 'aguardando_pagamento', pagamento_status: 'pendente', total_centavos: 2200, canal: 'proprio' })

    // o cliente acompanha só com o token, sem login
    const ver = () => como(db, anon, () =>
      db.query<{ numero: string; status: string }>(`select numero, status from public.acompanhar_pedido($1)`, [corpo.token]))
    const visto = (await ver()).rows[0]
    expect(Number(visto.numero)).toBe(corpo.numero)
    expect(visto.status).toBe('aguardando_pagamento')

    // a cozinha avança o pedido (no futuro, pelo painel/webhook) e o cliente enxerga
    await db.exec(`update public.pedidos set status = 'em_preparo', pagamento_status = 'pago' where token_acompanhamento = '${corpo.token}'`)
    expect((await ver()).rows[0].status).toBe('em_preparo')

    // e o cliente continua sem ler a tabela
    await expect(como(db, anon, () => db.query(`select * from public.pedidos`))).rejects.toThrow(/permission denied/)
  })

  it('calcular não grava nada', async () => {
    const antes = await n(`select count(*)::int as n from public.pedidos`)
    const r = await chamar('calcular', pedidoBase('71966660002'))
    expect(r.status).toBe(200)
    expect(await n(`select count(*)::int as n from public.pedidos`)).toBe(antes)
  })

  it('valores forjados pelo navegador não chegam ao banco: vale o preço do servidor', async () => {
    const fraude = {
      ...pedidoBase('71966660003'),
      totalCentavos: 1,
      taxaEntregaCentavos: 0,
      itens: [{ produtoId: REFRI, quantidade: 2, escolhas: {}, precoUnitarioCentavos: 1, totalCentavos: 2 }],
    }
    const r = await chamar('confirmar', fraude)
    const corpo = (await r.json()) as { token: string }
    const { rows } = await db.query<{ total_centavos: number; taxa_entrega_centavos: number }>(
      `select total_centavos, taxa_entrega_centavos from public.pedidos where token_acompanhamento = $1`, [corpo.token])
    expect(rows[0]).toEqual({ total_centavos: 2200, taxa_entrega_centavos: 800 })
  })

  it('loja fechada: recusado e NADA é gravado', async () => {
    const antes = { p: await n(`select count(*)::int as n from public.pedidos`), c: await n(`select count(*)::int as n from public.clientes`) }
    agora = new Date('2026-09-22T15:00:00Z') // terça 12:00
    const r = await chamar('confirmar', pedidoBase('71966660004'))
    agora = new Date('2026-09-18T21:30:00Z')
    expect(r.status).toBe(422)
    expect(await n(`select count(*)::int as n from public.pedidos`)).toBe(antes.p)
    expect(await n(`select count(*)::int as n from public.clientes`)).toBe(antes.c)
  })

  it('anti-spam do banco chega ao cliente como 429 amigável, sem vazar detalhe', async () => {
    const tel = '71966660005'
    for (let i = 0; i < 3; i++) expect((await chamar('confirmar', pedidoBase(tel))).status).toBe(200)
    const r = await chamar('confirmar', pedidoBase(tel))
    const corpo = JSON.stringify(await r.json())
    expect(r.status).toBe(429)
    expect(corpo).toContain('MUITOS_PEDIDOS')
    expect(corpo).not.toMatch(/limite_pedidos_pendentes|P0001|postgres/i)
  })
})

describe('combo com escolhas repetidas (2.11) de ponta a ponta', () => {
  it('2 combos de "3 lanches" com Smash 2x e Burguer 1x somam as vendas por produto real', async () => {
    const pedido = {
      cliente: { nome: 'João Souza', telefone: '71966660006' },
      tipo: 'retirada',
      itens: [{ produtoId: COMBO, quantidade: 2, escolhas: { 'g-lanches': ['o-smash', 'o-smash', 'o-burguer'] } }],
    }
    const r = await chamar('confirmar', pedido)
    const corpo = (await r.json()) as { ok: boolean; token: string; pedido: { totalCentavos: number } }
    expect(r.status).toBe(200)
    // cada combo: 5000 + 400 (o Burguer paga a diferença 1x) = 5400; 2 combos = 10800
    expect(corpo.pedido.totalCentavos).toBe(10_800)

    const { rows } = await db.query<{ produto_id: string; unidades: number }>(
      `select c.produto_id, sum(c.quantidade)::int as unidades
         from public.itens_pedido_componentes c
         join public.itens_pedido i on i.id = c.item_pedido_id
         join public.pedidos p on p.id = i.pedido_id
        where p.token_acompanhamento = $1 group by c.produto_id order by c.produto_id`, [corpo.token])
    // 2 combos: Smash 2x por combo = 4 unidades; Burguer 1x por combo = 2 unidades
    expect(rows).toEqual([
      { produto_id: SMASH, unidades: 4 },
      { produto_id: BURGUER, unidades: 2 },
    ])
  })
})
