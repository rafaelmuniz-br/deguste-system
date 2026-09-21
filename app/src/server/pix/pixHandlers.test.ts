import { describe, expect, it, vi } from 'vitest'
import type { AvisoRecebido, GatewayPix } from './gateway.ts'
import {
  criarHandlerGerarPix,
  criarHandlerWebhookPix,
  type DependenciasPix,
  type PedidoParaPix,
} from './pixHandlers.ts'

const TOKEN = '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f'
const AGORA = new Date('2026-09-18T20:00:00Z')

const pedidoAguardando = (extra: Partial<PedidoParaPix> = {}): PedidoParaPix => ({
  id: 'ped-1',
  numero: 42,
  totalCentavos: 3579,
  status: 'aguardando_pagamento',
  pagamentoStatus: 'pendente',
  pixCopiaCola: null,
  pagamentoExpiraEm: null,
  ...extra,
})

function gatewayFalso(o: Partial<GatewayPix> = {}) {
  const gateway = {
    nome: 'falso',
    criarCobranca: vi.fn(async () => ({
      externoId: 'mp-1',
      copiaCola: 'PIX-COPIA-COLA',
      expiraEm: '2026-09-18T20:30:00.000Z',
    })),
    validarAviso: vi.fn((_a: AvisoRecebido) => true),
    extrairPagamentoId: vi.fn((_a: AvisoRecebido) => 'mp-1' as string | null),
    consultarPagamento: vi.fn(async () => ({
      externoId: 'mp-1',
      aprovado: true,
      valorCentavos: 3579,
      statusBruto: 'approved',
    })),
    ...o,
  }
  return gateway as GatewayPix & typeof gateway
}

function dependencias(over: Partial<DependenciasPix> = {}) {
  const gateway = (over.gateway as ReturnType<typeof gatewayFalso> | undefined) ?? gatewayFalso()
  const dep = {
    gateway,
    buscarPedidoPorToken: vi.fn(async () => pedidoAguardando()),
    registrarCobranca: vi.fn(async () => 'registrada' as const),
    confirmarPagamento: vi.fn(async () => 'confirmado' as const),
    agora: () => AGORA,
    registrar: vi.fn(),
    ...over,
  }
  return dep as typeof dep & DependenciasPix
}

const post = (corpo: unknown, url = 'https://x.exemplo/.netlify/functions/gerar-pix') =>
  new Request(url, {
    method: 'POST',
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
    headers: { 'x-nf-client-connection-ip': '1.2.3.4' },
  })

describe('gerar-pix', () => {
  it('cria a cobrança com o valor do BANCO, guarda no pedido e devolve o copia e cola', async () => {
    const dep = dependencias()
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({
      copiaCola: 'PIX-COPIA-COLA',
      expiraEm: '2026-09-18T20:30:00.000Z',
    })
    expect(dep.gateway.criarCobranca).toHaveBeenCalledWith({
      pedidoId: 'ped-1',
      numero: 42,
      valorCentavos: 3579,
      expiraEmMinutos: 30,
    })
    expect(dep.registrarCobranca).toHaveBeenCalledWith(
      'ped-1',
      expect.objectContaining({ externoId: 'mp-1' }),
    )
  })

  it('valor enviado pelo navegador é IGNORADO (só o token é lido)', async () => {
    const dep = dependencias()
    await criarHandlerGerarPix(dep)(post({ token: TOKEN, valorCentavos: 1, total: 1 }))
    expect(dep.gateway.criarCobranca).toHaveBeenCalledWith(
      expect.objectContaining({ valorCentavos: 3579 }),
    )
  })

  it('já tem Pix válido: devolve o mesmo, sem criar outra cobrança', async () => {
    const dep = dependencias({
      buscarPedidoPorToken: vi.fn(async () =>
        pedidoAguardando({ pixCopiaCola: 'JA-EXISTE', pagamentoExpiraEm: '2026-09-18T20:20:00Z' }),
      ),
    })
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(await r.json()).toEqual({ copiaCola: 'JA-EXISTE', expiraEm: '2026-09-18T20:20:00Z' })
    expect(dep.gateway.criarCobranca).not.toHaveBeenCalled()
  })

  it('Pix já vencido: 409 pix_expirado (o pedido será cancelado pela expiração)', async () => {
    const dep = dependencias({
      buscarPedidoPorToken: vi.fn(async () =>
        pedidoAguardando({ pixCopiaCola: 'X', pagamentoExpiraEm: '2026-09-18T19:59:00Z' }),
      ),
    })
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ erro: 'pix_expirado' })
  })

  it.each([
    ['pago', { status: 'novo', pagamentoStatus: 'pago' }],
    ['cancelado', { status: 'cancelado', pagamentoStatus: 'expirado' }],
    ['em preparo', { status: 'em_preparo', pagamentoStatus: 'pago' }],
  ])('pedido %s não gera Pix (409)', async (_nome, extra) => {
    const dep = dependencias({ buscarPedidoPorToken: vi.fn(async () => pedidoAguardando(extra)) })
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(r.status).toBe(409)
    expect(dep.gateway.criarCobranca).not.toHaveBeenCalled()
  })

  it('token desconhecido: 404; token que não parece UUID: 400 sem tocar o banco', async () => {
    const dep = dependencias({ buscarPedidoPorToken: vi.fn(async () => null) })
    expect((await criarHandlerGerarPix(dep)(post({ token: TOKEN }))).status).toBe(404)

    const dep2 = dependencias()
    for (const corpo of [{ token: 'abc' }, { token: 123 }, {}, { token: "' or 1=1 --" }]) {
      expect((await criarHandlerGerarPix(dep2)(post(corpo))).status).toBe(400)
    }
    expect((await criarHandlerGerarPix(dep2)(post('não é json'))).status).toBe(400)
    expect(dep2.buscarPedidoPorToken).not.toHaveBeenCalled()
  })

  it('só POST; corpo grande demais é recusado', async () => {
    const dep = dependencias()
    const h = criarHandlerGerarPix(dep)
    expect((await h(new Request('https://x.exemplo/', { method: 'GET' }))).status).toBe(405)
    expect((await h(post('x'.repeat(21_000)))).status).toBe(413)
  })

  it('limite por IP: barra o excesso com 429', async () => {
    const dep = dependencias({
      limitarGerar: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
    })
    const h = criarHandlerGerarPix(dep)
    expect((await h(post({ token: TOKEN }))).status).toBe(200)
    expect((await h(post({ token: TOKEN }))).status).toBe(429)
  })

  it('gateway fora do ar: 502 genérico, sem vazar o motivo, e registra no log', async () => {
    const gateway = gatewayFalso({
      criarCobranca: vi.fn(async () => {
        throw new Error('Mercado Pago respondeu 500 com dado secreto')
      }),
    })
    const dep = dependencias({ gateway })
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(r.status).toBe(502)
    expect(JSON.stringify(await r.json())).not.toContain('secreto')
    expect(dep.registrar).toHaveBeenCalled()
    expect(dep.registrarCobranca).not.toHaveBeenCalled()
  })

  it('banco recusou registrar (outra cobrança já existe): 409, sem devolver o código novo', async () => {
    const dep = dependencias({
      registrarCobranca: vi.fn(async () => 'outra_cobranca_existente' as const),
    })
    const r = await criarHandlerGerarPix(dep)(post({ token: TOKEN }))
    expect(r.status).toBe(409)
    expect(JSON.stringify(await r.json())).not.toContain('PIX-COPIA-COLA')
  })
})

describe('webhook-pix', () => {
  const aviso = (corpo: unknown = { type: 'payment', data: { id: 'mp-1' } }) =>
    post(corpo, 'https://x.exemplo/.netlify/functions/webhook-pix?data.id=mp-1&type=payment')

  it('fluxo feliz: valida, consulta o gateway e confirma no banco com o valor RECEBIDO', async () => {
    const dep = dependencias()
    const r = await criarHandlerWebhookPix(dep)(aviso())
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ resultado: 'confirmado' })
    expect(dep.gateway.consultarPagamento).toHaveBeenCalledWith('mp-1')
    expect(dep.confirmarPagamento).toHaveBeenCalledWith('mp-1', 3579)
  })

  it('ASSINATURA INVÁLIDA: 401 e NADA acontece (nem consulta, nem banco)', async () => {
    const gateway = gatewayFalso({ validarAviso: vi.fn(() => false) })
    const dep = dependencias({ gateway })
    const r = await criarHandlerWebhookPix(dep)(aviso())
    expect(r.status).toBe(401)
    expect(dep.gateway.consultarPagamento).not.toHaveBeenCalled()
    expect(dep.confirmarPagamento).not.toHaveBeenCalled()
  })

  it('o conteúdo do aviso não é confiado: quem manda é o estado consultado no gateway', async () => {
    const gateway = gatewayFalso({
      consultarPagamento: vi.fn(async () => ({
        externoId: 'mp-1',
        aprovado: false,
        valorCentavos: 3579,
        statusBruto: 'pending',
      })),
    })
    const dep = dependencias({ gateway })
    // o aviso "diz" que foi aprovado, mas o gateway diz que está pendente
    const r = await criarHandlerWebhookPix(dep)(
      aviso({ type: 'payment', data: { id: 'mp-1' }, status: 'approved' }),
    )
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ resultado: 'ignorado', status: 'pending' })
    expect(dep.confirmarPagamento).not.toHaveBeenCalled()
  })

  it('aviso que não é de pagamento: 200 (o gateway não repete) sem consultar nada', async () => {
    const gateway = gatewayFalso({ extrairPagamentoId: vi.fn(() => null) })
    const dep = dependencias({ gateway })
    const r = await criarHandlerWebhookPix(dep)(aviso({ type: 'merchant_order' }))
    expect(r.status).toBe(200)
    expect(dep.gateway.consultarPagamento).not.toHaveBeenCalled()
  })

  it.each(['ja_confirmado', 'desconhecido'] as const)(
    'resultado %s do banco responde 200 (repetição é normal)',
    async (resultado) => {
      const dep = dependencias({ confirmarPagamento: vi.fn(async () => resultado) })
      const r = await criarHandlerWebhookPix(dep)(aviso())
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ resultado })
      expect(dep.registrar).not.toHaveBeenCalled()
    },
  )

  it.each(['valor_divergente', 'pago_apos_cancelamento'] as const)(
    '%s: responde 200 mas REGISTRA no log para alguém agir',
    async (resultado) => {
      const dep = dependencias({ confirmarPagamento: vi.fn(async () => resultado) })
      const r = await criarHandlerWebhookPix(dep)(aviso())
      expect(r.status).toBe(200)
      expect(dep.registrar).toHaveBeenCalledWith(`webhook-pix: ${resultado}`, { pagamento: 'mp-1' })
    },
  )

  it('DUPLICADO na prática: o mesmo aviso duas vezes chama o banco duas vezes (que é idempotente) e ambos dão 200', async () => {
    const confirmarPagamento = vi
      .fn()
      .mockResolvedValueOnce('confirmado')
      .mockResolvedValueOnce('ja_confirmado')
    const dep = dependencias({ confirmarPagamento })
    const h = criarHandlerWebhookPix(dep)
    expect(await (await h(aviso())).json()).toEqual({ resultado: 'confirmado' })
    expect(await (await h(aviso())).json()).toEqual({ resultado: 'ja_confirmado' })
  })

  it('falha ao consultar o gateway ou gravar no banco: 502 (o gateway tenta de novo), detalhe só no log', async () => {
    const semGateway = dependencias({
      gateway: gatewayFalso({
        consultarPagamento: vi.fn(async () => {
          throw new Error('timeout')
        }),
      }),
    })
    const r1 = await criarHandlerWebhookPix(semGateway)(aviso())
    expect(r1.status).toBe(502)
    expect(semGateway.confirmarPagamento).not.toHaveBeenCalled()

    const semBanco = dependencias({
      confirmarPagamento: vi.fn(async () => {
        throw new Error('connection refused')
      }),
    })
    const r2 = await criarHandlerWebhookPix(semBanco)(aviso())
    expect(r2.status).toBe(502)
    expect(JSON.stringify(await r2.json())).not.toContain('connection')
    expect(semBanco.registrar).toHaveBeenCalled()
  })

  it('gateway sem configuração (variável faltando): 502 limpo, sem derrubar a function', async () => {
    const dep = dependencias()
    Object.defineProperty(dep, 'gateway', {
      get() {
        throw new Error('Gateway de Pix não configurado no servidor')
      },
    })
    const r = await criarHandlerWebhookPix(dep)(aviso())
    expect(r.status).toBe(502)
    expect(dep.confirmarPagamento).not.toHaveBeenCalled()
  })

  it('só POST; corpo grande demais recusado', async () => {
    const h = criarHandlerWebhookPix(dependencias())
    expect((await h(new Request('https://x.exemplo/', { method: 'GET' }))).status).toBe(405)
    expect((await h(post('x'.repeat(21_000)))).status).toBe(413)
  })
})
