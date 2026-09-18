import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { calcularPedido } from '../../app/src/domain/pedido.ts'
import { montarLinhasDoBanco } from '../../app/src/domain/pedidoBanco.ts'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { ADMIN_ID, anon, como, criarBanco, servico, type Papel } from './helpers.ts'

const SMASH = '00000000-0000-4000-8001-000000000001'
const BURGUER = '00000000-0000-4000-8001-000000000002'
const COMBO = '00000000-0000-4000-8001-000000000004'
const CAT = '00000000-0000-4000-8000-000000000001'
const AGENTE_ID = '33333333-3333-4333-8333-333333333333'
const LOGADO_ID = '44444444-4444-4444-8444-444444444444'

const agente: Papel = { role: 'authenticated', userId: AGENTE_ID }
const admin: Papel = { role: 'authenticated', userId: ADMIN_ID }
const logadoComum: Papel = { role: 'authenticated', userId: LOGADO_ID }

const cardapio: Cardapio = {
  categorias: [{ id: CAT, nome: 'Ofertas', ordem: 1 }],
  produtos: [
    { id: SMASH, categoriaId: CAT, nome: 'Smash', precoCentavos: 2199, ehCombo: false, disponivel: true, grupos: [] },
    { id: BURGUER, categoriaId: CAT, nome: 'Burguer', precoCentavos: 3399, ehCombo: false, disponivel: true, grupos: [] },
    {
      id: COMBO,
      categoriaId: CAT,
      nome: 'Combo 2 lanches',
      precoCentavos: 4000,
      ehCombo: true,
      disponivel: true,
      grupos: [
        {
          id: 'g',
          nome: 'Escolha 2',
          minEscolhas: 2,
          maxEscolhas: 2,
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
    modo: 'forcar_aberta',
    pedidoMinimoCentavos: 0,
    tempoPreparoMin: 30,
    horarios: [],
    entrega: { regra: { tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 }, raioMaximoKm: 6 },
  },
}

let db: PGlite
let seq = 0

beforeAll(async () => {
  db = await criarBanco()
  await db.exec(`insert into auth.users (id) values ('${AGENTE_ID}'), ('${LOGADO_ID}');
                 insert into public.agentes_impressao (user_id) values ('${AGENTE_ID}');`)
}, 60_000)

afterAll(async () => {
  await db.close()
})

// Cada teste começa com a fila vazia.
beforeEach(async () => {
  await db.exec(`delete from public.impressoes; delete from public.pedidos;`)
})

/** Cria um pedido (pelo mesmo caminho da produção) e, se `pago`, marca como pago (o que enfileira a impressão). */
async function novoPedido(pago = true, obs = 'sem cebola') {
  const telefone = `7198888${String(1000 + ++seq)}`
  const r = await calcularPedido(
    {
      cliente: { nome: 'Maria Silva', telefone },
      tipo: 'entrega',
      endereco: { rua: 'Rua das Flores', numero: '10', bairro: 'Pituba', complemento: 'apto 2' },
      itens: [{ produtoId: COMBO, quantidade: 2, escolhas: { g: ['o-smash', 'o-burguer'] }, observacao: obs }],
      observacoes: 'tocar a campainha',
    },
    { cardapio, agora: new Date(), resolverDistanciaKm: async () => 2 },
  )
  if (!r.ok) throw new Error(JSON.stringify(r.erros))
  const linhas = montarLinhasDoBanco(r.pedido)
  await como(db, servico, () => db.query(`select * from public.criar_pedido($1::jsonb)`, [JSON.stringify(linhas)]))
  if (pago) await db.exec(`update public.pedidos set pagamento_status = 'pago', status = 'novo' where id = '${linhas.pedido.id}'`)
  return linhas.pedido.id
}

const proxima = (papel: Papel = agente) =>
  como(db, papel, async () => (await db.query<{ p: any }>(`select public.proxima_impressao() as p`)).rows[0].p)
const confirmar = (id: string, papel: Papel = agente) => como(db, papel, () => db.query(`select public.confirmar_impressao($1)`, [id]))
const falhar = (id: string, erro = 'sem papel', papel: Papel = agente) =>
  como(db, papel, async () => (await db.query<{ r: string }>(`select public.registrar_falha_impressao($1, $2) as r`, [id, erro])).rows[0].r)
const linha = async (pedidoId: string) =>
  (await db.query<any>(`select * from public.impressoes where pedido_id = $1`, [pedidoId])).rows[0]

describe('entrada na fila', () => {
  it('pedido que passa a "pago" entra na fila uma vez só', async () => {
    const id = await novoPedido(false)
    expect(await linha(id)).toBeUndefined() // aguardando pagamento: nada a imprimir
    await db.exec(`update public.pedidos set pagamento_status = 'pago' where id = '${id}'`)
    expect((await linha(id)).status).toBe('pendente')
    await db.exec(`update public.pedidos set pagamento_status = 'pago', observacoes = 'x' where id = '${id}'`) // atualizar de novo não duplica
    expect(Number((await db.query<{ n: number }>(`select count(*)::int as n from public.impressoes`)).rows[0].n)).toBe(1)
  })

  it('pedido que já nasce pago (ex.: marketplace) também entra', async () => {
    const id = await novoPedido(false)
    await db.exec(`delete from public.pedidos where id = '${id}'`)
    await db.exec(`insert into public.pedidos (canal, cliente_nome, cliente_telefone, tipo, status, pagamento_status, subtotal_centavos, total_centavos)
                   values ('ifood', 'Fulano', '71900000000', 'retirada', 'novo', 'pago', 1000, 1000)`)
    const { rows } = await db.query<{ status: string }>(`select status from public.impressoes`)
    expect(rows).toEqual([{ status: 'pendente' }])
  })

  it('pagamento pendente, expirado ou estornado não enfileira', async () => {
    const id = await novoPedido(false)
    for (const st of ['expirado', 'falhou', 'estornado']) {
      await db.exec(`update public.pedidos set pagamento_status = '${st}' where id = '${id}'`)
    }
    expect(await linha(id)).toBeUndefined()
  })
})

describe('proxima_impressao', () => {
  it('devolve tudo que o recibo precisa e reserva o trabalho', async () => {
    const id = await novoPedido()
    const job = await proxima()
    expect(job.tentativa).toBe(1)
    expect(job.reimpressao).toBe(false)
    expect(job.pedido).toMatchObject({
      canal: 'proprio', tipo: 'entrega', cliente_nome: 'Maria Silva',
      endereco_rua: 'Rua das Flores', endereco_numero: '10', endereco_bairro: 'Pituba', endereco_complemento: 'apto 2',
      observacoes: 'tocar a campainha', pagamento_status: 'pago', total_centavos: (4000 + 400) * 2 + 800,
    })
    expect(job.itens).toHaveLength(1)
    expect(job.itens[0]).toMatchObject({ nome: 'Combo 2 lanches', quantidade: 2, observacoes: 'sem cebola' })
    expect(job.itens[0].componentes).toEqual([
      { grupo: 'Escolha 2', opcao: 'Burguer', quantidade: 2 },
      { grupo: 'Escolha 2', opcao: 'Smash', quantidade: 2 },
    ])
    expect((await linha(id)).status).toBe('em_impressao')
  })

  it('fila vazia devolve null; trabalho reservado não é entregue duas vezes', async () => {
    expect(await proxima()).toBeNull()
    await novoPedido()
    expect(await proxima()).not.toBeNull()
    expect(await proxima()).toBeNull() // já está reservado por outro ciclo
  })

  it('imprime em ordem de chegada (o mais antigo primeiro)', async () => {
    const a = await novoPedido()
    const b = await novoPedido()
    await db.exec(`update public.impressoes set created_at = now() - interval '1 minute' where pedido_id = '${b}'`)
    const primeiro = await proxima()
    expect((await linha(b)).status).toBe('em_impressao')
    expect((await linha(a)).status).toBe('pendente')
    expect(primeiro.impressao_id).toBe((await linha(b)).id)
  })

  it('se o agente some no meio, a reserva expira e o trabalho volta (contando a tentativa)', async () => {
    const id = await novoPedido()
    await proxima()
    expect(await proxima()).toBeNull() // ainda reservado
    await db.exec(`update public.impressoes set reserva_ate = now() - interval '1 second' where pedido_id = '${id}'`)
    const de_novo = await proxima()
    expect(de_novo.tentativa).toBe(2)
  })

  it('reserva expirada com tentativas esgotadas vira "falhou" (problema visível) e não trava a fila', async () => {
    const preso = await novoPedido()
    const outro = await novoPedido()
    await db.exec(`update public.impressoes set created_at = now() - interval '5 minutes', status = 'em_impressao', tentativas = 5,
                   reserva_ate = now() - interval '1 second' where pedido_id = '${preso}'`)
    const job = await proxima() // pula o preso e entrega o outro
    expect(job.impressao_id).toBe((await linha(outro)).id)
    expect((await linha(preso)).status).toBe('falhou')
  })
})

describe('confirmação e falhas', () => {
  it('confirmar marca como impresso e nunca mais volta para a fila', async () => {
    const id = await novoPedido()
    const job = await proxima()
    await confirmar(job.impressao_id)
    const l = await linha(id)
    expect(l).toMatchObject({ status: 'impresso', vezes_impresso: 1, erro: null })
    expect(l.impresso_em).not.toBeNull()
    expect(await proxima()).toBeNull()
  })

  it('não confirma o que não foi reservado (proteção contra confirmação duplicada)', async () => {
    const id = await novoPedido()
    const job = await proxima()
    await confirmar(job.impressao_id)
    await expect(confirmar(job.impressao_id)).rejects.toThrow(/impressao_nao_reservada/)
    expect((await linha(id)).vezes_impresso).toBe(1)
  })

  it('falha: volta para a fila com espera crescente e o erro registrado', async () => {
    const id = await novoPedido()
    const job = await proxima()
    expect(await falhar(job.impressao_id, 'impressora sem papel')).toBe('pendente')
    const l = await linha(id)
    expect(l).toMatchObject({ status: 'pendente', erro: 'impressora sem papel' })
    expect(await proxima()).toBeNull() // ainda esperando (backoff)
    const espera = Number((await db.query<{ s: number }>(`select extract(epoch from (proxima_tentativa_em - now()))::int as s from public.impressoes where pedido_id = '${id}'`)).rows[0].s)
    expect(espera).toBeGreaterThan(5)
    expect(espera).toBeLessThanOrEqual(10)
    await db.exec(`update public.impressoes set proxima_tentativa_em = now() - interval '1 second' where pedido_id = '${id}'`)
    expect((await proxima()).tentativa).toBe(2)
  })

  it('a espera dobra a cada falha, com teto de 5 minutos', async () => {
    const id = await novoPedido()
    const esperas: number[] = []
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      await db.exec(`update public.impressoes set proxima_tentativa_em = null where pedido_id = '${id}'`)
      const job = await proxima()
      await falhar(job.impressao_id)
      esperas.push(Number((await db.query<{ s: number }>(`select round(extract(epoch from (proxima_tentativa_em - now())))::int as s from public.impressoes where pedido_id = '${id}'`)).rows[0].s))
    }
    expect(esperas).toEqual([10, 20, 40, 80])
  })

  it('na 5ª falha vira "falhou" e aparece como problema; some da fila automática', async () => {
    const id = await novoPedido()
    let resultado = ''
    for (let i = 0; i < 5; i++) {
      await db.exec(`update public.impressoes set proxima_tentativa_em = null where pedido_id = '${id}'`)
      const job = await proxima()
      resultado = await falhar(job.impressao_id, 'sem papel')
    }
    expect(resultado).toBe('falhou')
    expect(await proxima()).toBeNull()
    const { rows } = await como(db, admin, () => db.query<{ status: string; erro: string }>(`select status, erro from public.impressoes_com_problema`))
    expect(rows).toEqual([{ status: 'falhou', erro: 'sem papel' }])
  })

  it('pedido pendente há mais de 2 minutos sem imprimir também é problema', async () => {
    const id = await novoPedido()
    await db.exec(`update public.impressoes set created_at = now() - interval '3 minutes' where pedido_id = '${id}'`)
    const { rows } = await como(db, admin, () => db.query(`select * from public.impressoes_com_problema`))
    expect(rows).toHaveLength(1)
  })
})

describe('reimpressão (4.10)', () => {
  it('admin manda imprimir de novo um pedido já impresso; a reimpressão vem marcada', async () => {
    const id = await novoPedido()
    await confirmar((await proxima()).impressao_id)
    await como(db, admin, () => db.query(`select public.reimprimir_pedido($1)`, [id]))
    const job = await proxima()
    expect(job.reimpressao).toBe(true)
    await confirmar(job.impressao_id)
    expect((await linha(id)).vezes_impresso).toBe(2)
  })

  it('também recoloca na fila um pedido que tinha falhado', async () => {
    const id = await novoPedido()
    await db.exec(`update public.impressoes set status = 'falhou', tentativas = 5 where pedido_id = '${id}'`)
    await como(db, admin, () => db.query(`select public.reimprimir_pedido($1)`, [id]))
    expect((await linha(id)).status).toBe('pendente')
    expect((await proxima()).tentativa).toBe(1)
  })
})

describe('permissões', () => {
  it('visitante anônimo não opera a fila nem vê a tabela', async () => {
    await novoPedido()
    await expect(proxima(anon)).rejects.toThrow(/permission denied/)
    await expect(como(db, anon, () => db.query(`select * from public.impressoes`))).rejects.toThrow(/permission denied/)
    await expect(como(db, anon, () => db.query(`select * from public.impressoes_com_problema`))).rejects.toThrow(/permission denied/)
  })

  it('usuário logado que NÃO é agente nem admin é recusado em todas as funções', async () => {
    const id = await novoPedido()
    await expect(proxima(logadoComum)).rejects.toThrow(/sem_permissao/)
    await expect(confirmar('00000000-0000-4000-8000-000000000000', logadoComum)).rejects.toThrow(/sem_permissao/)
    await expect(falhar('00000000-0000-4000-8000-000000000000', 'x', logadoComum)).rejects.toThrow(/sem_permissao/)
    await expect(como(db, logadoComum, () => db.query(`select public.reimprimir_pedido($1)`, [id]))).rejects.toThrow(/sem_permissao/)
    expect((await linha(id)).status).toBe('pendente') // nada foi alterado
  })

  it('o agente NÃO lê pedidos, clientes nem a fila diretamente (só as funções)', async () => {
    await novoPedido()
    await expect(como(db, agente, () => db.query(`select * from public.pedidos`))).resolves.toMatchObject({ rows: [] })
    await expect(como(db, agente, () => db.query(`select * from public.clientes`))).resolves.toMatchObject({ rows: [] })
    await expect(como(db, agente, () => db.query(`select * from public.impressoes`))).resolves.toMatchObject({ rows: [] })
  })

  it('o agente não consegue se cadastrar nem cadastrar outro agente', async () => {
    await expect(como(db, logadoComum, () => db.query(`insert into public.agentes_impressao (user_id) values ($1)`, [LOGADO_ID]))).rejects.toThrow(/permission denied/)
  })

  it('o servidor (service role) também opera a fila', async () => {
    await novoPedido()
    expect((await proxima(servico))).not.toBeNull()
  })
})
