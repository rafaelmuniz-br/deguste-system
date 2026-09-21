import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Cardapio } from '../../app/src/domain/tipos.ts'
import { criarHandler } from '../../app/src/server/pedidosHandler.ts'
import type { AvisoRecebido, GatewayPix } from '../../app/src/server/pix/gateway.ts'
import {
  criarHandlerGerarPix,
  criarHandlerWebhookPix,
  type DependenciasPix,
} from '../../app/src/server/pix/pixHandlers.ts'
import { anon, como, criarBanco, servico } from './helpers.ts'

// FLUXO DO PAGAMENTO (3.14): as funções do servidor de verdade (criar pedido, gerar Pix, webhook) falando
// com o banco de verdade (todas as migrations), via PGlite. Só o GATEWAY é simulado, e de forma
// semelhante à real: guarda cobranças, só "paga" quando mandamos, e o aviso só vale com assinatura.

const REFRI = '00000000-0000-4000-8001-000000000003'
const CAT = '00000000-0000-4000-8000-000000000001'

const cardapio: Cardapio = {
  categorias: [{ id: CAT, nome: 'Ofertas', ordem: 1 }],
  produtos: [
    { id: REFRI, categoriaId: CAT, nome: 'Refri', precoCentavos: 700, ehCombo: false, disponivel: true, grupos: [] },
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
// Os ids do gateway são únicos no mundo todo (o banco tem índice único): contador compartilhado entre os testes.
let proximoIdGateway = 5000

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

// ---------- gateway simulado ----------

type Cobranca = { valorCentavos: number; status: 'pending' | 'approved' }

function criarGatewayDeTeste() {
  const cobrancas = new Map<string, Cobranca>()
  let criadas = 0

  const gateway: GatewayPix & {
    pagar: (id: string, valor?: number) => void
    avisar: (id: string, opcoes?: { assinatura?: string }) => Request
    cobrancas: typeof cobrancas
    criadas: () => number
  } = {
    nome: 'teste',
    cobrancas,
    criadas: () => criadas,
    async criarCobranca(p) {
      criadas++
      const externoId = String(++proximoIdGateway)
      cobrancas.set(externoId, { valorCentavos: p.valorCentavos, status: 'pending' })
      return {
        externoId,
        copiaCola: `PIX-${externoId}-${p.valorCentavos}`,
        expiraEm: new Date(Date.now() + p.expiraEmMinutos * 60_000).toISOString(),
      }
    },
    validarAviso: ({ headers }: AvisoRecebido) => headers.get('x-assinatura') === 'valida',
    extrairPagamentoId: ({ corpo }: AvisoRecebido) => {
      const c = JSON.parse(corpo) as { type?: string; data?: { id?: string } }
      return c.type === 'payment' && c.data?.id ? c.data.id : null
    },
    async consultarPagamento(externoId) {
      const c = cobrancas.get(externoId)
      if (!c) throw new Error('cobrança inexistente no gateway')
      return { externoId, aprovado: c.status === 'approved', valorCentavos: c.valorCentavos, statusBruto: c.status }
    },
    /** O cliente pagou no app do banco. `valor` permite simular pagamento com valor diferente. */
    pagar(id, valor) {
      const c = cobrancas.get(id)!
      c.status = 'approved'
      if (valor !== undefined) c.valorCentavos = valor
    },
    avisar: (id, opcoes) =>
      new Request('https://loja.test/.netlify/functions/webhook-pix', {
        method: 'POST',
        headers: { 'x-assinatura': opcoes?.assinatura ?? 'valida' },
        body: JSON.stringify({ type: 'payment', data: { id } }),
      }),
  }
  return gateway
}

// ---------- as mesmas chamadas que as functions reais fazem ao Supabase ----------

function dependenciasPix(gateway: GatewayPix): DependenciasPix {
  return {
    gateway,
    buscarPedidoPorToken: async (token) => {
      const { rows } = await db.query<{
        id: string
        numero: string
        total_centavos: number
        status: string
        pagamento_status: string
        pix_copia_cola: string | null
        pagamento_expira_em: string | null
      }>(
        `select id, numero, total_centavos, status, pagamento_status, pix_copia_cola, pagamento_expira_em
           from public.pedidos where token_acompanhamento = $1`,
        [token],
      )
      const l = rows[0]
      return l
        ? {
            id: l.id,
            numero: Number(l.numero),
            totalCentavos: l.total_centavos,
            status: l.status,
            pagamentoStatus: l.pagamento_status,
            pixCopiaCola: l.pix_copia_cola,
            pagamentoExpiraEm: l.pagamento_expira_em === null ? null : new Date(l.pagamento_expira_em).toISOString(),
          }
        : null
    },
    registrarCobranca: async (pedidoId, c) =>
      (
        await como(db, servico, () =>
          db.query<{ r: never }>(`select public.registrar_cobranca_pix($1, $2, $3, $4) as r`, [
            pedidoId,
            c.externoId,
            c.copiaCola,
            c.expiraEm,
          ]),
        )
      ).rows[0].r,
    confirmarPagamento: async (externoId, valor) =>
      (
        await como(db, servico, () =>
          db.query<{ r: never }>(`select public.confirmar_pagamento_pix($1, $2) as r`, [externoId, valor]),
        )
      ).rows[0].r,
    registrar: () => {},
  }
}

const criarPedido = async () => {
  seq++
  const handler = criarHandler({
    carregarCardapio: async () => cardapio,
    distanciaKm: async () => 2,
    criarPedidoNoBanco: async (linhas) => {
      const { rows } = await como(db, servico, () =>
        db.query<{ o_numero: string; o_token: string }>(`select * from public.criar_pedido($1::jsonb)`, [JSON.stringify(linhas)]),
      )
      return { numero: Number(rows[0].o_numero), token: rows[0].o_token }
    },
    limitarConfirmar: () => true,
  })
  const r = await handler(
    new Request('https://loja.test/.netlify/functions/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        acao: 'confirmar',
        pedido: {
          cliente: { nome: 'Maria', telefone: `7196666${String(1000 + seq)}` },
          tipo: 'retirada',
          itens: [{ produtoId: REFRI, quantidade: 2, escolhas: {} }], // 1400
        },
      }),
    }),
  )
  const corpo = (await r.json()) as { token: string; numero: number }
  return { token: corpo.token, numero: corpo.numero, total: 1400 }
}

const gerar = (dep: DependenciasPix, token: string) =>
  criarHandlerGerarPix({ ...dep, limitarGerar: () => true })(
    new Request('https://loja.test/.netlify/functions/gerar-pix', { method: 'POST', body: JSON.stringify({ token }) }),
  )

const estado = async (token: string) =>
  (
    await db.query<{ status: string; pagamento_status: string; pix_copia_cola: string | null }>(
      `select status, pagamento_status, pix_copia_cola from public.pedidos where token_acompanhamento = $1`,
      [token],
    )
  ).rows[0]

const naFila = async (token: string) =>
  Number(
    (
      await db.query<{ n: number }>(
        `select count(*) n from public.impressoes i join public.pedidos p on p.id = i.pedido_id where p.token_acompanhamento = $1`,
        [token],
      )
    ).rows[0].n,
  )

const naCozinha = async (token: string) =>
  Number(
    (
      await db.query<{ n: number }>(
        `select count(*) n from public.pedidos where token_acompanhamento = $1 and pagamento_status = 'pago' and status in ('novo','em_preparo','pronto','saiu_para_entrega')`,
        [token],
      )
    ).rows[0].n,
  )

const acompanhar = async (token: string) =>
  como(db, anon, async () =>
    (
      await db.query<{ status: string; pagamento_status: string; pix_copia_cola: string | null }>(
        `select status, pagamento_status, pix_copia_cola from public.acompanhar_pedido($1)`,
        [token],
      )
    ).rows[0],
  )

describe('Pix de ponta a ponta', () => {
  it('pedido → Pix → pagamento → webhook: vira pago, entra na cozinha e na impressora, e o cliente vê', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token, total } = await criarPedido()

    // 1) gerar Pix: valor vem do banco
    const r = await gerar(dep, token)
    expect(r.status).toBe(200)
    const pix = (await r.json()) as { copiaCola: string; expiraEm: string }
    expect(pix.copiaCola).toBe(`PIX-${[...gw.cobrancas.keys()][0]}-${total}`)
    expect([...gw.cobrancas.values()][0].valorCentavos).toBe(total)

    // o cliente, na página de acompanhamento, enxerga o mesmo código enquanto aguarda
    const antes = await acompanhar(token)
    expect(antes).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente', pix_copia_cola: pix.copiaCola })
    expect(await naCozinha(token)).toBe(0)

    // 2) cliente paga; 3) gateway avisa
    const id = [...gw.cobrancas.keys()][0]
    gw.pagar(id)
    const w = await criarHandlerWebhookPix(dep)(gw.avisar(id))
    expect(w.status).toBe(200)
    expect(await w.json()).toEqual({ resultado: 'confirmado' })

    // 4) resultado
    expect(await estado(token)).toMatchObject({ status: 'novo', pagamento_status: 'pago' })
    expect(await naCozinha(token)).toBe(1)
    expect(await naFila(token)).toBe(1)
    const depois = await acompanhar(token)
    expect(depois).toMatchObject({ status: 'novo', pagamento_status: 'pago', pix_copia_cola: null })
  })

  it('DUPLICADO: o gateway repete o aviso várias vezes (até ao mesmo tempo) e nada duplica', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]
    gw.pagar(id)
    const h = criarHandlerWebhookPix(dep)

    const respostas = await Promise.all([h(gw.avisar(id)), h(gw.avisar(id)), h(gw.avisar(id))])
    const resultados = await Promise.all(respostas.map(async (r) => ((await r.json()) as { resultado: string }).resultado))
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200])
    expect(resultados.filter((x) => x === 'confirmado')).toHaveLength(1)
    expect(resultados.filter((x) => x === 'ja_confirmado')).toHaveLength(2)

    expect(await naFila(token)).toBe(1)
    expect(await naCozinha(token)).toBe(1)
    expect((await estado(token)).status).toBe('novo')

    // e um aviso tardio, depois da cozinha já ter andado, não "volta" o pedido
    await db.query(`update public.pedidos set status = 'em_preparo' where token_acompanhamento = $1`, [token])
    await h(gw.avisar(id))
    expect((await estado(token)).status).toBe('em_preparo')
  })

  it('gerar Pix duas vezes (recarregou a página): mesmo código, UMA cobrança no gateway', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    const a = (await (await gerar(dep, token)).json()) as { copiaCola: string }
    const b = (await (await gerar(dep, token)).json()) as { copiaCola: string }
    expect(b.copiaCola).toBe(a.copiaCola)
    expect(gw.criadas()).toBe(1)
  })

  it('assinatura inválida: 401 e o pedido continua aguardando pagamento (mesmo que o gateway diga que pagou)', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]
    gw.pagar(id)

    const w = await criarHandlerWebhookPix(dep)(gw.avisar(id, { assinatura: 'forjada' }))
    expect(w.status).toBe(401)
    expect(await estado(token)).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente' })
    expect(await naFila(token)).toBe(0)
  })

  it('aviso de pagamento ainda não aprovado (pendente): ignorado, pedido segue aguardando', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]

    const w = await criarHandlerWebhookPix(dep)(gw.avisar(id)) // não pagou
    expect(await w.json()).toEqual({ resultado: 'ignorado', status: 'pending' })
    expect((await estado(token)).pagamento_status).toBe('pendente')
  })

  it('VALOR DIVERGENTE (gateway diz que entrou outro valor): não confirma e vai para revisão', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token, total } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]
    gw.pagar(id, total - 100)

    const w = await criarHandlerWebhookPix(dep)(gw.avisar(id))
    expect(await w.json()).toEqual({ resultado: 'valor_divergente' })
    expect(await estado(token)).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente' })
    expect(await naCozinha(token)).toBe(0)
    const { rows } = await db.query(`select motivo from public.pagamentos_para_revisar p join public.pedidos o on o.id = p.pedido_id where o.token_acompanhamento = $1`, [token])
    expect(rows).toEqual([{ motivo: 'valor_divergente' }])
  })

  it('PAGAMENTO APÓS EXPIRAÇÃO: pedido expira, o Pix cai depois, NÃO vai para a cozinha e fica para estorno', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]

    // o tempo passa: Pix venceu há 1 hora
    await db.query(
      `update public.pedidos set pagamento_expira_em = now() - interval '60 minutes', created_at = now() - interval '90 minutes' where token_acompanhamento = $1`,
      [token],
    )
    const cancelados = await como(db, servico, async () => (await db.query<{ n: number }>(`select public.expirar_pedidos_pendentes(30) as n`)).rows[0].n)
    expect(cancelados).toBeGreaterThanOrEqual(1)
    expect(await acompanhar(token)).toMatchObject({ status: 'cancelado', pagamento_status: 'expirado', pix_copia_cola: null })

    // depois o cliente paga mesmo assim (o QR ainda estava na tela do banco dele)
    gw.pagar(id)
    const w = await criarHandlerWebhookPix(dep)(gw.avisar(id))
    expect(await w.json()).toEqual({ resultado: 'pago_apos_cancelamento' })

    expect(await naCozinha(token)).toBe(0)
    expect(await naFila(token)).toBe(0)
    expect((await estado(token)).status).toBe('cancelado')
    const { rows } = await db.query(`select motivo, valor_recebido_centavos from public.pagamentos_para_revisar p join public.pedidos o on o.id = p.pedido_id where o.token_acompanhamento = $1`, [token])
    expect(rows).toEqual([{ motivo: 'pago_apos_cancelamento', valor_recebido_centavos: 1400 }])
  })

  it('pedido já pago não gera outro Pix; token inexistente é 404', async () => {
    const gw = criarGatewayDeTeste()
    const dep = dependenciasPix(gw)
    const { token } = await criarPedido()
    await gerar(dep, token)
    const id = [...gw.cobrancas.keys()][0]
    gw.pagar(id)
    await criarHandlerWebhookPix(dep)(gw.avisar(id))

    expect((await gerar(dep, token)).status).toBe(409)
    expect(gw.criadas()).toBe(1)
    expect((await gerar(dep, '00000000-0000-4000-8000-00000000dead')).status).toBe(404)
  })
})
