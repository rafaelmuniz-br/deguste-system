import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcularPedido, type PedidoEntrada } from '../../app/src/domain/pedido.ts'
import { montarLinhasDoBanco } from '../../app/src/domain/pedidoBanco.ts'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { anon, clienteLogado, como, criarBanco, servico } from './helpers.ts'

const SMASH = '00000000-0000-4000-8001-000000000001'
const CAT = '00000000-0000-4000-8000-000000000001'

const cardapio: Cardapio = {
  categorias: [{ id: CAT, nome: 'Ofertas', ordem: 1 }],
  produtos: [{ id: SMASH, categoriaId: CAT, nome: 'Smash Exemplo', precoCentavos: 2199, ehCombo: false, disponivel: true, grupos: [] }],
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

async function criarPedido(telefone: string, nome: string, over: Partial<PedidoEntrada> = {}) {
  const entrada: PedidoEntrada = {
    cliente: { nome, telefone },
    tipo: 'entrega',
    endereco: { rua: 'Rua Secreta', numero: '77', bairro: 'Pituba', complemento: 'apto 5', referencia: 'portão azul' },
    itens: [{ produtoId: SMASH, quantidade: 1, escolhas: {}, observacao: `entregar para ${nome}` }],
    observacoes: `ligar para ${nome}`,
    ...over,
  }
  const r = await calcularPedido(entrada, { cardapio, agora: new Date(), resolverDistanciaKm: async () => 2 })
  if (!r.ok) throw new Error(JSON.stringify(r.erros))
  const linhas = montarLinhasDoBanco(r.pedido)
  await como(db, servico, () => db.query(`select * from public.criar_pedido($1::jsonb)`, [JSON.stringify(linhas)]))
  return linhas.pedido.id
}

const concluir = (id: string) => db.exec(`update public.pedidos set status = 'concluido', pagamento_status = 'pago' where id = '${id}'`)

describe('exportar_dados_cliente (acesso e portabilidade)', () => {
  it('devolve cliente, pedidos com itens e endereço, e o saldo de cashback', async () => {
    const tel = '71955550001'
    await criarPedido(tel, 'Maria Silva')
    const { rows } = await como(db, servico, () =>
      db.query<{ dados: any }>(`select public.exportar_dados_cliente($1) as dados`, [tel]))
    const d = rows[0].dados
    expect(d.cliente).toMatchObject({ nome: 'Maria Silva', telefone: tel })
    expect(d.pedidos).toHaveLength(1)
    expect(d.pedidos[0]).toMatchObject({ nome_no_pedido: 'Maria Silva', total_centavos: 2199 + 500 + 300 })
    expect(d.pedidos[0].endereco).toMatchObject({ rua: 'Rua Secreta', bairro: 'Pituba', referencia: 'portão azul' })
    expect(d.pedidos[0].itens[0]).toMatchObject({ nome: 'Smash Exemplo', quantidade: 1 })
    expect(d.saldo_cashback_centavos).toBe(0)
  })

  it('não vaza dados de OUTRA pessoa e, para telefone desconhecido, vem vazio', async () => {
    await criarPedido('71955550002', 'Joana Souza')
    const { rows } = await como(db, servico, () =>
      db.query<{ dados: any }>(`select public.exportar_dados_cliente('71955550001') as dados`))
    expect(JSON.stringify(rows[0].dados)).not.toContain('Joana')
    const vazio = await como(db, servico, () => db.query<{ dados: any }>(`select public.exportar_dados_cliente('71000000000') as dados`))
    expect(vazio.rows[0].dados.cliente).toBeNull()
    expect(vazio.rows[0].dados.pedidos).toEqual([])
  })
})

describe('anonimizar_cliente (eliminação)', () => {
  it('remove o cadastro, mantém o pedido SEM dado pessoal e preserva os valores', async () => {
    const tel = '71955550010'
    const id = await criarPedido(tel, 'Carlos Pereira')
    await concluir(id)
    const { rows } = await como(db, servico, () =>
      db.query<{ pedidos_anonimizados: number; cliente_removido: boolean }>(`select * from public.anonimizar_cliente($1)`, [tel]))
    expect(rows[0]).toEqual({ pedidos_anonimizados: 1, cliente_removido: true })

    const { rows: ped } = await db.query<Record<string, unknown>>(`select * from public.pedidos where id = $1`, [id])
    const p = ped[0]
    expect(p).toMatchObject({
      cliente_nome: 'Cliente removido', cliente_telefone: 'removido', cliente_id: null,
      endereco_rua: '(removido)', endereco_numero: null, endereco_complemento: null,
      endereco_referencia: null, observacoes: null, endereco_bairro: 'Pituba', // bairro fica
      total_centavos: 2199 + 500 + 300,
    })
    // nenhum vestígio do nome ou do telefone em nenhuma tabela
    const vestigios = await db.query<{ n: number }>(`
      select (select count(*) from public.clientes where telefone = '${tel}' or nome like '%Carlos%')
           + (select count(*) from public.pedidos where cliente_nome like '%Carlos%' or cliente_telefone = '${tel}' or observacoes like '%Carlos%')
           + (select count(*) from public.itens_pedido where observacoes like '%Carlos%') as n`)
    expect(Number(vestigios.rows[0].n)).toBe(0)
  })

  it('não toca nos dados de outras pessoas', async () => {
    const outra = '71955550011'
    const id = await criarPedido(outra, 'Ana Lima')
    await concluir(id)
    const alvo = '71955550012'
    await concluir(await criarPedido(alvo, 'Bruno Costa'))
    await como(db, servico, () => db.query(`select * from public.anonimizar_cliente($1)`, [alvo]))
    const { rows } = await db.query<{ cliente_nome: string }>(`select cliente_nome from public.pedidos where id = $1`, [id])
    expect(rows[0].cliente_nome).toBe('Ana Lima')
    expect(Number((await db.query<{ n: number }>(`select count(*)::int as n from public.clientes where telefone = '${outra}'`)).rows[0].n)).toBe(1)
  })

  it('recusa enquanto houver pedido em andamento (a entrega ainda precisa dos dados)', async () => {
    const tel = '71955550013'
    await criarPedido(tel, 'Diana Rocha') // aguardando pagamento
    await expect(como(db, servico, () => db.query(`select * from public.anonimizar_cliente($1)`, [tel]))).rejects.toThrow(/pedido_em_andamento/)
    const { rows } = await db.query<{ cliente_nome: string }>(`select cliente_nome from public.pedidos where cliente_telefone = '${tel}'`)
    expect(rows[0].cliente_nome).toBe('Diana Rocha') // nada foi alterado
  })

  it('cancelado conta como encerrado e pode ser anonimizado', async () => {
    const tel = '71955550014'
    const id = await criarPedido(tel, 'Eduardo Melo')
    await db.exec(`update public.pedidos set status = 'cancelado', motivo_cancelamento = 'teste' where id = '${id}'`)
    const { rows } = await como(db, servico, () => db.query<{ cliente_removido: boolean }>(`select * from public.anonimizar_cliente($1)`, [tel]))
    expect(rows[0].cliente_removido).toBe(true)
  })

  it('telefone desconhecido ou já anonimizado: nada a fazer, sem erro', async () => {
    const { rows } = await como(db, servico, () =>
      db.query<{ pedidos_anonimizados: number; cliente_removido: boolean }>(`select * from public.anonimizar_cliente('71000000001')`))
    expect(rows[0]).toEqual({ pedidos_anonimizados: 0, cliente_removido: false })
  })

  it('apaga também o saldo de cashback do cliente', async () => {
    const tel = '71955550015'
    await concluir(await criarPedido(tel, 'Fátima Nunes'))
    await db.exec(`insert into public.cashback_movimentos (cliente_id, tipo, valor_centavos)
      select id, 'credito', 500 from public.clientes where telefone = '${tel}'`)
    await como(db, servico, () => db.query(`select * from public.anonimizar_cliente($1)`, [tel]))
    expect(Number((await db.query<{ n: number }>(`select count(*)::int as n from public.cashback_movimentos`)).rows[0].n)).toBe(0)
  })
})

describe('permissões', () => {
  it('visitante e usuário logado NÃO executam nenhuma das duas funções', async () => {
    for (const papel of [anon, clienteLogado]) {
      await expect(como(db, papel, () => db.query(`select public.exportar_dados_cliente('71955550001')`))).rejects.toThrow(/permission denied/)
      await expect(como(db, papel, () => db.query(`select * from public.anonimizar_cliente('71955550001')`))).rejects.toThrow(/permission denied/)
    }
  })
})
