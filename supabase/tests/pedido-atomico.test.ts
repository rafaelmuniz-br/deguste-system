import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcularPedido, type PedidoEntrada } from '../../app/src/domain/pedido.ts'
import { montarLinhasDoBanco } from '../../app/src/domain/pedidoBanco.ts'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { anon, clienteLogado, como, criarBanco, servico } from './helpers.ts'

// Testa a função criar_pedido (gravação atômica) e acompanhar_pedido (acompanhamento sem login) usando
// como entrada EXATAMENTE o que o código do app gera (montarLinhasDoBanco). Mesmos ids do seed.

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

const entrada = (telefone: string, over: Partial<PedidoEntrada> = {}): PedidoEntrada => ({
  cliente: { nome: 'Maria Silva', telefone },
  tipo: 'retirada',
  itens: [
    { produtoId: COMBO, quantidade: 2, escolhas: { 'g-ham': ['o-smash'] } },
    { produtoId: REFRI, quantidade: 1, escolhas: {} },
  ],
  ...over,
})

/** Payload da função: o que o servidor manda, gerado pelo mesmo código de produção. */
async function payload(e: PedidoEntrada) {
  const r = await calcularPedido(e, { cardapio, agora: new Date(), resolverDistanciaKm: async () => 2 })
  if (!r.ok) throw new Error(JSON.stringify(r.erros))
  return montarLinhasDoBanco(r.pedido)
}

const chamar = (p: unknown) =>
  db.query<{ o_id: string; o_numero: string; o_token: string }>(`select * from public.criar_pedido($1::jsonb)`, [
    JSON.stringify(p),
  ])

const contar = async (tabela: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from public.${tabela}`)).rows[0].n

describe('criar_pedido: gravação atômica', () => {
  it('grava cliente, pedido, itens e componentes de uma vez e devolve número e token', async () => {
    const linhas = await payload(entrada('71911110001'))
    const { rows } = await como(db, servico, () => chamar(linhas))

    expect(rows).toHaveLength(1)
    expect(rows[0].o_id).toBe(linhas.pedido.id)
    expect(Number(rows[0].o_numero)).toBeGreaterThan(0)
    expect(rows[0].o_token).toMatch(/^[0-9a-f-]{36}$/)

    const { rows: ped } = await db.query<{ status: string; pagamento_status: string; total_centavos: number; cliente_id: string }>(
      `select status, pagamento_status, total_centavos, cliente_id from public.pedidos where id = $1`,
      [linhas.pedido.id],
    )
    expect(ped[0]).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente', total_centavos: 3999 * 2 + 700 })
    expect(ped[0].cliente_id).not.toBeNull()

    const { rows: itens } = await db.query<{ n: number }>(`select count(*)::int as n from public.itens_pedido where pedido_id = $1`, [linhas.pedido.id])
    expect(itens[0].n).toBe(2)
    // combo: a venda do Smash dentro dele aparece por produto real (2 combos = 2 unidades)
    const { rows: vendas } = await db.query<{ u: number }>(
      `select sum(quantidade)::int as u from public.itens_pedido_componentes where produto_id = $1`, [SMASH])
    expect(vendas[0].u).toBe(2)
  })

  it('reaproveita o cliente pelo telefone e guarda o nome mais recente', async () => {
    const a = await payload(entrada('71911110002', { cliente: { nome: 'Joana', telefone: '71911110002' } }))
    const b = await payload(entrada('71911110002', { cliente: { nome: 'Joana Souza', telefone: '71911110002' } }))
    await como(db, servico, () => chamar(a))
    await como(db, servico, () => chamar(b))
    const { rows } = await db.query<{ nome: string }>(`select nome from public.clientes where telefone = '71911110002'`)
    expect(rows).toEqual([{ nome: 'Joana Souza' }])
  })

  it('status, pagamento e canal vêm do banco: o que o payload disser sobre isso é ignorado', async () => {
    const linhas = await payload(entrada('71911110003'))
    const adulterado = {
      ...linhas,
      pedido: { ...linhas.pedido, status: 'concluido', pagamento_status: 'pago', canal: 'ifood' },
    }
    await como(db, servico, () => chamar(adulterado))
    const { rows } = await db.query<{ status: string; pagamento_status: string; canal: string }>(
      `select status, pagamento_status, canal from public.pedidos where id = $1`, [linhas.pedido.id])
    expect(rows[0]).toEqual({ status: 'aguardando_pagamento', pagamento_status: 'pendente', canal: 'proprio' })
  })

  it('tudo ou nada: falha no meio não deixa pedido, itens nem cliente pela metade', async () => {
    const linhas = await payload(entrada('71911110004'))
    const quebrado = {
      ...linhas,
      itens: [...linhas.itens, { ...linhas.itens[0], id: crypto.randomUUID(), produto_id: '99999999-9999-4999-8999-999999999999' }],
    }
    const antes = { ped: await contar('pedidos'), itens: await contar('itens_pedido'), cli: await contar('clientes') }
    await expect(como(db, servico, () => chamar(quebrado))).rejects.toThrow(/foreign key|violates/)
    expect({ ped: await contar('pedidos'), itens: await contar('itens_pedido'), cli: await contar('clientes') }).toEqual(antes)
  })

  it('recusa quando os itens não somam o subtotal, sem gravar nada', async () => {
    const linhas = await payload(entrada('71911110005'))
    const antes = await contar('pedidos')
    const errado = { ...linhas, itens: linhas.itens.map((i, k) => (k === 0 ? { ...i, total_centavos: i.total_centavos + 1 } : i)) }
    await expect(como(db, servico, () => chamar(errado))).rejects.toThrow(/totais_inconsistentes/)
    expect(await contar('pedidos')).toBe(antes)
  })

  it('recusa componente ligado a item de OUTRO pedido', async () => {
    const primeiro = await payload(entrada('71911110006'))
    await como(db, servico, () => chamar(primeiro))
    const segundo = await payload(entrada('71911110007'))
    const invasor = {
      ...segundo,
      componentes: [{ ...segundo.componentes[0], item_pedido_id: primeiro.itens[0].id }],
    }
    await expect(como(db, servico, () => chamar(invasor))).rejects.toThrow(/componente_fora_do_pedido/)
  })

  it('recusa payload sem itens ou vazio', async () => {
    await expect(como(db, servico, () => chamar({}))).rejects.toThrow(/pedido_invalido/)
    const linhas = await payload(entrada('71911110008'))
    await expect(como(db, servico, () => chamar({ ...linhas, itens: [] }))).rejects.toThrow(/pedido_invalido/)
  })
})

describe('criar_pedido: anti-spam (3.11)', () => {
  it('no máximo 3 pedidos aguardando pagamento por telefone em 15 minutos; outro telefone não é afetado', async () => {
    const tel = '71922220001'
    for (let i = 0; i < 3; i++) await como(db, servico, async () => chamar(await payload(entrada(tel))))
    await expect(como(db, servico, async () => chamar(await payload(entrada(tel))))).rejects.toThrow(/limite_pedidos_pendentes/)
    await como(db, servico, async () => chamar(await payload(entrada('71922220002'))))
  })

  it('pedido já pago não conta no limite', async () => {
    const tel = '71922220003'
    for (let i = 0; i < 3; i++) await como(db, servico, async () => chamar(await payload(entrada(tel))))
    await db.exec(`update public.pedidos set status = 'novo', pagamento_status = 'pago' where cliente_telefone = '${tel}'`)
    await como(db, servico, async () => chamar(await payload(entrada(tel))))
  })

  it('pedido pendente antigo (mais de 15 minutos) não conta', async () => {
    const tel = '71922220004'
    for (let i = 0; i < 3; i++) await como(db, servico, async () => chamar(await payload(entrada(tel))))
    await db.exec(`update public.pedidos set created_at = now() - interval '20 minutes' where cliente_telefone = '${tel}'`)
    await como(db, servico, async () => chamar(await payload(entrada(tel))))
  })
})

describe('permissões', () => {
  it('visitante e usuário logado NÃO executam criar_pedido', async () => {
    const linhas = await payload(entrada('71933330001'))
    await expect(como(db, anon, () => chamar(linhas))).rejects.toThrow(/permission denied/)
    await expect(como(db, clienteLogado, () => chamar(linhas))).rejects.toThrow(/permission denied/)
  })
})

describe('acompanhar_pedido: acompanhamento sem login (3.10)', () => {
  it('com o token o visitante vê só o mínimo; sem ele não vê nada', async () => {
    const linhas = await payload(entrada('71944440001', { tipo: 'entrega', endereco: { rua: 'Rua Secreta', numero: '77', bairro: 'Pituba' } }))
    const { rows } = await como(db, servico, () => chamar(linhas))
    const token = rows[0].o_token

    const status = await como(db, anon, () =>
      db.query<Record<string, unknown>>(`select * from public.acompanhar_pedido($1)`, [token]))
    expect(status.rows).toHaveLength(1)
    expect(Object.keys(status.rows[0]).sort()).toEqual(
      ['criado_em', 'numero', 'pagamento_expira_em', 'pagamento_status', 'pix_copia_cola', 'status', 'tipo', 'total_centavos'])
    // nenhum dado pessoal vaza
    expect(JSON.stringify(status.rows[0])).not.toMatch(/Rua Secreta|71944440001|Maria/)
    expect(status.rows[0]).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente', tipo: 'entrega' })

    const outro = await como(db, anon, () =>
      db.query(`select * from public.acompanhar_pedido('00000000-0000-4000-8000-00000000dead')`))
    expect(outro.rows).toHaveLength(0)
  })

  it('o visitante continua sem poder ler a tabela de pedidos', async () => {
    await expect(como(db, anon, () => db.query(`select * from public.pedidos`))).rejects.toThrow(/permission denied/)
  })

  it('o status acompanha a mudança feita pela cozinha', async () => {
    const linhas = await payload(entrada('71944440002'))
    const { rows } = await como(db, servico, () => chamar(linhas))
    await db.exec(`update public.pedidos set status = 'em_preparo', pagamento_status = 'pago' where id = '${linhas.pedido.id}'`)
    const s = await como(db, anon, () => db.query<{ status: string }>(`select status from public.acompanhar_pedido($1)`, [rows[0].o_token]))
    expect(s.rows[0].status).toBe('em_preparo')
  })
})
