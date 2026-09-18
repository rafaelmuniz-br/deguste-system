import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardapioExemplo } from '../data/exemplo.ts'
import type { LinhasDoBanco } from '../domain/pedidoBanco.ts'
import { criarHandler, type Dependencias } from './pedidosHandler.ts'

const ABERTA = new Date('2026-09-18T21:30:00Z') // sexta 18:30 na Bahia
const FECHADA = new Date('2026-09-18T20:00:00Z') // sexta 17:00 na Bahia

const pedidoValido = {
  cliente: { nome: 'Maria Silva', telefone: '(71) 99999-1234' },
  tipo: 'retirada',
  itens: [{ produtoId: 'beb-agua', quantidade: 2, escolhas: {} }],
}

function montar(over: Partial<Dependencias> = {}) {
  const criarPedidoNoBanco = vi.fn(async (_linhas: LinhasDoBanco) => ({
    numero: 42,
    token: 'tok-123',
  }))
  const distanciaKm = vi.fn(async () => 3.2)
  const deps: Dependencias = {
    carregarCardapio: async () => structuredClone(cardapioExemplo),
    distanciaKm,
    criarPedidoNoBanco,
    agora: () => ABERTA,
    ...over,
  }
  return { handler: criarHandler(deps), criarPedidoNoBanco, distanciaKm }
}

const post = (corpo: unknown, headers: Record<string, string> = {}) =>
  new Request('https://exemplo.test/.netlify/functions/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })

const ler = async (r: Response) => (await r.json()) as Record<string, any>

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('pedidosHandler: protocolo', () => {
  it('só aceita POST', async () => {
    const { handler } = montar()
    const r = await handler(new Request('https://exemplo.test/x', { method: 'GET' }))
    expect(r.status).toBe(405)
    expect(r.headers.get('Allow')).toBe('POST')
  })

  it('responde sempre JSON, sem cache', async () => {
    const { handler } = montar()
    const r = await handler(post({ acao: 'calcular', pedido: pedidoValido }))
    expect(r.headers.get('Content-Type')).toContain('application/json')
    expect(r.headers.get('Cache-Control')).toBe('no-store')
  })

  it('recusa corpo grande demais (declarado ou real)', async () => {
    const { handler } = montar()
    const grande = 'x'.repeat(25_000)
    const r1 = await handler(post({ acao: 'calcular', pedido: { observacoes: grande } }))
    expect(r1.status).toBe(413)
    const r2 = await handler(post('{}', { 'content-length': '999999' }))
    expect(r2.status).toBe(413)
  })

  it('recusa JSON inválido e ação desconhecida sem estourar', async () => {
    const { handler } = montar()
    expect((await handler(post('isto não é json'))).status).toBe(400)
    expect((await handler(post({ acao: 'apagar-tudo', pedido: pedidoValido }))).status).toBe(400)
    expect((await handler(post(null))).status).toBe(400)
  })

  it('pedido malformado: 400 com os erros, sem tocar no banco', async () => {
    const { handler, criarPedidoNoBanco } = montar()
    const r = await handler(
      post({ acao: 'confirmar', pedido: { cliente: {}, tipo: 'drone', itens: 'x' } }),
    )
    const corpo = await ler(r)
    expect(r.status).toBe(400)
    expect(corpo.ok).toBe(false)
    expect(corpo.erros.length).toBeGreaterThan(0)
    expect(criarPedidoNoBanco).not.toHaveBeenCalled()
  })
})

describe('pedidosHandler: calcular', () => {
  it('devolve o total calculado no servidor e NÃO grava nada', async () => {
    const { handler, criarPedidoNoBanco } = montar()
    const r = await handler(post({ acao: 'calcular', pedido: pedidoValido }))
    const corpo = await ler(r)
    expect(r.status).toBe(200)
    expect(corpo.pedido.totalCentavos).toBe(400 * 2)
    expect(criarPedidoNoBanco).not.toHaveBeenCalled()
  })

  it('ignora preço, frete e total enviados pelo navegador', async () => {
    const { handler } = montar()
    const fraude = {
      ...pedidoValido,
      totalCentavos: 1,
      taxaEntregaCentavos: 0,
      itens: [{ ...pedidoValido.itens[0], precoUnitarioCentavos: 1, totalCentavos: 1 }],
    }
    const corpo = await ler(await handler(post({ acao: 'calcular', pedido: fraude })))
    expect(corpo.pedido.totalCentavos).toBe(800)
  })

  it('entrega: consulta a distância com a origem da loja e soma o frete', async () => {
    const cardapio = structuredClone(cardapioExemplo)
    cardapio.loja.entrega.origem = { latitude: -13, longitude: -38.5 }
    const { handler, distanciaKm } = montar({ carregarCardapio: async () => cardapio })
    const r = await handler(
      post({
        acao: 'calcular',
        pedido: {
          ...pedidoValido,
          tipo: 'entrega',
          endereco: { rua: 'Rua A', numero: '1', bairro: 'Pituba' },
        },
      }),
    )
    const corpo = await ler(r)
    expect(corpo.pedido.taxaEntregaCentavos).toBe(980) // 500 + 150 x 3,2 km
    expect(distanciaKm).toHaveBeenCalledWith(
      { latitude: -13, longitude: -38.5 },
      expect.objectContaining({ rua: 'Rua A' }),
    )
  })

  it('regra de negócio violada: 422 com o motivo (loja fechada)', async () => {
    const { handler } = montar({ agora: () => FECHADA })
    const r = await handler(post({ acao: 'calcular', pedido: pedidoValido }))
    expect(r.status).toBe(422)
    expect((await ler(r)).erros[0].codigo).toBe('LOJA_FECHADA')
  })
})

describe('pedidosHandler: confirmar', () => {
  it('grava uma vez com as linhas do banco e devolve número e token', async () => {
    const { handler, criarPedidoNoBanco } = montar()
    const r = await handler(post({ acao: 'confirmar', pedido: pedidoValido }))
    const corpo = await ler(r)
    expect(r.status).toBe(200)
    expect(corpo).toMatchObject({ ok: true, numero: 42, token: 'tok-123' })
    expect(criarPedidoNoBanco).toHaveBeenCalledOnce()
    const linhas = criarPedidoNoBanco.mock.calls[0][0]
    expect(linhas.pedido).toMatchObject({
      canal: 'proprio',
      status: 'aguardando_pagamento',
      cliente_telefone: '71999991234',
      total_centavos: 800,
    })
    expect(linhas.itens).toHaveLength(1)
  })

  it('não grava quando a validação de negócio falha', async () => {
    const { handler, criarPedidoNoBanco } = montar({ agora: () => FECHADA })
    await handler(post({ acao: 'confirmar', pedido: pedidoValido }))
    expect(criarPedidoNoBanco).not.toHaveBeenCalled()
  })

  it('limite de pedidos pendentes do banco vira 429 amigável', async () => {
    const { handler } = montar({
      criarPedidoNoBanco: async () => {
        throw new Error('limite_pedidos_pendentes')
      },
    })
    const r = await handler(post({ acao: 'confirmar', pedido: pedidoValido }))
    expect(r.status).toBe(429)
    expect((await ler(r)).erros[0].codigo).toBe('MUITOS_PEDIDOS')
  })

  it('falha do banco: 500 genérico, sem vazar detalhe nem telefone', async () => {
    const { handler } = montar({
      criarPedidoNoBanco: async () => {
        throw new Error('duplicate key ... (telefone)=(71999991234)')
      },
    })
    const r = await handler(post({ acao: 'confirmar', pedido: pedidoValido }))
    const texto = JSON.stringify(await ler(r))
    expect(r.status).toBe(500)
    expect(texto).not.toMatch(/duplicate|71999991234|telefone/)
    // e o log também não recebe o telefone
    const logado = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .join(' ')
    expect(logado).not.toContain('71999991234')
  })

  it('cardápio indisponível: 503 e nada gravado', async () => {
    const { handler, criarPedidoNoBanco } = montar({
      carregarCardapio: async () => {
        throw new Error('Supabase não configurado no servidor')
      },
    })
    const r = await handler(post({ acao: 'confirmar', pedido: pedidoValido }))
    expect(r.status).toBe(503)
    expect(JSON.stringify(await ler(r))).not.toContain('Supabase')
    expect(criarPedidoNoBanco).not.toHaveBeenCalled()
  })
})

describe('pedidosHandler: limite por origem (3.11)', () => {
  it('a 7ª confirmação do mesmo IP no minuto é barrada; outro IP não é afetado', async () => {
    const { handler, criarPedidoNoBanco } = montar()
    const doIp = (ip: string) =>
      handler(
        post({ acao: 'confirmar', pedido: pedidoValido }, { 'x-nf-client-connection-ip': ip }),
      )
    for (let i = 0; i < 6; i++) expect((await doIp('1.1.1.1')).status).toBe(200)
    const barrada = await doIp('1.1.1.1')
    expect(barrada.status).toBe(429)
    expect(barrada.headers.get('Retry-After')).toBe('60')
    expect((await ler(barrada)).erros[0].codigo).toBe('MUITAS_REQUISICOES')
    expect((await doIp('2.2.2.2')).status).toBe(200)
    expect(criarPedidoNoBanco).toHaveBeenCalledTimes(7) // 6 do primeiro IP + 1 do segundo
  })

  it('calcular e confirmar têm limites separados', async () => {
    const { handler } = montar({ limitarConfirmar: () => false })
    expect((await handler(post({ acao: 'confirmar', pedido: pedidoValido }))).status).toBe(429)
    expect((await handler(post({ acao: 'calcular', pedido: pedidoValido }))).status).toBe(200)
  })
})
