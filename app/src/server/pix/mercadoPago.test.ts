import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { criarGatewayMercadoPago } from './mercadoPago.ts'

const SEGREDO = 'segredo-do-webhook'
const TOKEN = 'APP_USR-token-secreto'
const AGORA = new Date('2026-09-18T20:00:00Z') // 17:00 na Bahia

const resposta = (dados: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => dados }) as Response

function montar(fetchImpl = vi.fn()) {
  const gateway = criarGatewayMercadoPago({
    accessToken: TOKEN,
    webhookSecret: SEGREDO,
    notificationUrl: 'https://deguste.exemplo/.netlify/functions/webhook-pix',
    emailPagador: 'pagamentos@deguste.exemplo',
    fetchImpl,
    agora: () => AGORA,
  })
  return { gateway, fetchImpl }
}

describe('Mercado Pago: criarCobranca', () => {
  const pedido = {
    pedidoId: '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f',
    numero: 42,
    valorCentavos: 2190,
    expiraEmMinutos: 30,
  }
  const ok = {
    id: 1234567890,
    date_of_expiration: '2026-09-18T17:30:00.000-03:00',
    point_of_interaction: { transaction_data: { qr_code: '00020126580014br.gov.bcb.pix...' } },
  }

  it('pede um Pix com o valor em reais, chave de idempotência, prazo com fuso e URL do aviso', async () => {
    const { gateway, fetchImpl } = montar(vi.fn().mockResolvedValue(resposta(ok)))
    const c = await gateway.criarCobranca(pedido)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.mercadopago.com/v1/payments')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.headers['X-Idempotency-Key']).toBe(pedido.pedidoId)
    expect(url).not.toContain(TOKEN) // segredo nunca na URL

    const corpo = JSON.parse(init.body)
    expect(corpo).toMatchObject({
      transaction_amount: 21.9,
      payment_method_id: 'pix',
      payer: { email: 'pagamentos@deguste.exemplo' },
      external_reference: pedido.pedidoId,
      notification_url: 'https://deguste.exemplo/.netlify/functions/webhook-pix',
      description: 'Pedido 42 - Deguste Burguer',
    })
    // 20:00Z + 30 min = 20:30Z = 17:30 na Bahia (-03:00)
    expect(corpo.date_of_expiration).toBe('2026-09-18T17:30:00.000-03:00')

    expect(c).toEqual({
      externoId: '1234567890',
      copiaCola: '00020126580014br.gov.bcb.pix...',
      expiraEm: '2026-09-18T20:30:00.000Z',
    })
  })

  it.each([
    [1, 0.01],
    [99, 0.99],
    [2190, 21.9],
    [3579, 35.79],
    [100000, 1000],
  ])('%i centavos viram %d reais sem sobra de ponto flutuante', async (centavos, reais) => {
    const { gateway, fetchImpl } = montar(vi.fn().mockResolvedValue(resposta(ok)))
    await gateway.criarCobranca({ ...pedido, valorCentavos: centavos })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).transaction_amount).toBe(reais)
  })

  it('erro do Mercado Pago: lança sem vazar o corpo da resposta', async () => {
    const { gateway } = montar(
      vi.fn().mockResolvedValue(resposta({ message: 'dado sensível do pagador' }, false, 400)),
    )
    const erro = await gateway.criarCobranca(pedido).catch((e: Error) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).toBe('Mercado Pago respondeu 400')
    expect((erro as Error).message).not.toContain('sensível')
  })

  it('resposta sem código Pix é tratada como falha (nunca mostra um QR vazio)', async () => {
    const { gateway } = montar(
      vi.fn().mockResolvedValue(resposta({ id: 1, point_of_interaction: {} })),
    )
    await expect(gateway.criarCobranca(pedido)).rejects.toThrow(/não devolveu o código Pix/)
  })

  it('sem date_of_expiration na resposta: usa o prazo que pedimos', async () => {
    const { gateway } = montar(
      vi
        .fn()
        .mockResolvedValue(
          resposta({ id: 5, point_of_interaction: { transaction_data: { qr_code: 'X' } } }),
        ),
    )
    expect((await gateway.criarCobranca(pedido)).expiraEm).toBe('2026-09-18T20:30:00.000Z')
  })
})

describe('Mercado Pago: consultarPagamento', () => {
  it('approved = aprovado, com o valor em centavos', async () => {
    const { gateway, fetchImpl } = montar(
      vi.fn().mockResolvedValue(resposta({ status: 'approved', transaction_amount: 21.9 })),
    )
    expect(await gateway.consultarPagamento('123456')).toEqual({
      externoId: '123456',
      aprovado: true,
      valorCentavos: 2190,
      statusBruto: 'approved',
    })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.mercadopago.com/v1/payments/123456')
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET')
  })

  it.each(['pending', 'in_process', 'authorized', 'rejected', 'cancelled', 'refunded'])(
    '%s NÃO é dinheiro na conta',
    async (status) => {
      const { gateway } = montar(
        vi.fn().mockResolvedValue(resposta({ status, transaction_amount: 10 })),
      )
      expect((await gateway.consultarPagamento('123456')).aprovado).toBe(false)
    },
  )

  it('arredonda corretamente (0,29 × 100 não vira 28)', async () => {
    const { gateway } = montar(
      vi.fn().mockResolvedValue(resposta({ status: 'approved', transaction_amount: 0.29 })),
    )
    expect((await gateway.consultarPagamento('123456')).valorCentavos).toBe(29)
  })

  it('id que não é numérico nunca vira caminho de URL (evita injeção)', async () => {
    const { gateway, fetchImpl } = montar()
    await expect(gateway.consultarPagamento('../v1/payments/1')).rejects.toThrow(/inválido/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('valor ausente ou erro do gateway lançam (o webhook responde 502 e o gateway tenta de novo)', async () => {
    const semValor = montar(vi.fn().mockResolvedValue(resposta({ status: 'approved' })))
    await expect(semValor.gateway.consultarPagamento('123456')).rejects.toThrow(/valor/)
    const falha = montar(vi.fn().mockResolvedValue(resposta({}, false, 500)))
    await expect(falha.gateway.consultarPagamento('123456')).rejects.toThrow(
      'Mercado Pago respondeu 500',
    )
  })
})

describe('Mercado Pago: aviso (webhook)', () => {
  const { gateway } = montar()

  /** Monta um aviso como o Mercado Pago envia: id na URL, assinatura HMAC no cabeçalho. */
  function aviso(
    o: {
      id?: string
      segredo?: string
      requestId?: string
      ts?: string
      corpo?: unknown
      query?: string
      tipo?: string
    } = {},
  ) {
    const id = o.id ?? '123456'
    const requestId = o.requestId ?? 'req-abc'
    const ts = o.ts ?? '1758225600'
    const v1 = createHmac('sha256', o.segredo ?? SEGREDO)
      .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest('hex')
    return {
      headers: new Headers({ 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId }),
      url: new URL(
        `https://deguste.exemplo/.netlify/functions/webhook-pix?${o.query ?? `data.id=${id}&type=${o.tipo ?? 'payment'}`}`,
      ),
      corpo: JSON.stringify(o.corpo ?? { type: o.tipo ?? 'payment', data: { id } }),
    }
  }

  it('aceita assinatura correta', () => {
    expect(gateway.validarAviso(aviso())).toBe(true)
  })

  it('recusa segredo errado, id adulterado, request-id adulterado e ts adulterado', () => {
    expect(gateway.validarAviso(aviso({ segredo: 'outro-segredo' }))).toBe(false)

    const original = aviso({ id: '123456' })
    const idTrocado = {
      ...original,
      url: new URL(original.url.toString().replace('123456', '999999')),
    }
    expect(gateway.validarAviso(idTrocado)).toBe(false)

    const req = aviso({ requestId: 'req-abc' })
    req.headers.set('x-request-id', 'req-outro')
    expect(gateway.validarAviso(req)).toBe(false)

    const ts = aviso({ ts: '1758225600' })
    ts.headers.set('x-signature', ts.headers.get('x-signature')!.replace('ts=1758225600', 'ts=1'))
    expect(gateway.validarAviso(ts)).toBe(false)
  })

  it('recusa aviso sem cabeçalhos, com assinatura mal formada ou de tamanho errado — sem lançar', () => {
    const base = aviso()
    expect(gateway.validarAviso({ ...base, headers: new Headers() })).toBe(false)
    expect(gateway.validarAviso({ ...base, headers: new Headers({ 'x-request-id': 'r' }) })).toBe(
      false,
    )
    expect(
      gateway.validarAviso({
        ...base,
        headers: new Headers({ 'x-signature': 'lixo', 'x-request-id': 'r' }),
      }),
    ).toBe(false)
    expect(
      gateway.validarAviso({
        ...base,
        headers: new Headers({ 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r' }),
      }),
    ).toBe(false)
    expect(
      gateway.validarAviso({ ...base, url: new URL('https://x.exemplo/?type=payment'), corpo: '' }),
    ).toBe(false)
  })

  it('segredo do webhook vazio nunca valida (configuração faltando não pode liberar tudo)', () => {
    const semSegredo = criarGatewayMercadoPago({
      accessToken: 't',
      webhookSecret: '',
      notificationUrl: 'https://x',
      emailPagador: 'a@b.c',
    })
    const assinadoComVazio = aviso({ segredo: '' })
    expect(semSegredo.validarAviso(assinadoComVazio)).toBe(false)
  })

  it('o id vem da URL; se a URL não trouxer, do corpo', () => {
    const naUrl = aviso({ id: '777' })
    expect(gateway.extrairPagamentoId(naUrl)).toBe('777')

    const soNoCorpo = aviso({ id: '888', query: '' })
    expect(gateway.validarAviso(soNoCorpo)).toBe(true)
    expect(gateway.extrairPagamentoId(soNoCorpo)).toBe('888')
  })

  it('só aviso de PAGAMENTO interessa; outros tipos e ids estranhos viram null', () => {
    expect(gateway.extrairPagamentoId(aviso({ tipo: 'merchant_order' }))).toBeNull()
    expect(gateway.extrairPagamentoId(aviso({ tipo: 'plan' }))).toBeNull()
    expect(gateway.extrairPagamentoId(aviso({ id: 'abc' }))).toBeNull()
    expect(gateway.extrairPagamentoId(aviso({ id: '12' }))).toBeNull()
    const semTipo = aviso({ query: 'data.id=123456', corpo: {} })
    expect(gateway.extrairPagamentoId(semTipo)).toBeNull()
  })
})
