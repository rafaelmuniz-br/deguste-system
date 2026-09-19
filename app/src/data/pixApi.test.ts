import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarPixHttp, criarPixSimulado } from './pixApi.ts'

const TOKEN = '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f'

const resposta = (status: number, corpo: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response

afterEach(() => vi.unstubAllGlobals())

describe('criarPixHttp', () => {
  it('manda SÓ o token e devolve o código e o prazo', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(resposta(200, { copiaCola: 'CODIGO', expiraEm: '2026-09-18T20:30:00Z' }))
    vi.stubGlobal('fetch', f)
    const r = await criarPixHttp().gerar(TOKEN)
    expect(r).toEqual({ ok: true, copiaCola: 'CODIGO', expiraEm: '2026-09-18T20:30:00Z' })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('/.netlify/functions/gerar-pix')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN }) // nenhum valor vai do navegador
  })

  it('409 pix_expirado → expirado; outro 409 → não aguarda pagamento (já pago/cancelado)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(409, { erro: 'pix_expirado' })))
    expect(await criarPixHttp().gerar(TOKEN)).toEqual({ ok: false, motivo: 'expirado' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(resposta(409, { erro: 'pedido_nao_aguarda_pagamento' })),
    )
    expect(await criarPixHttp().gerar(TOKEN)).toEqual({
      ok: false,
      motivo: 'nao_aguarda_pagamento',
    })
  })

  it.each([
    [502, { erro: 'nao_foi_possivel_gerar_pix' }],
    [404, { erro: 'pedido_nao_encontrado' }],
    [429, { erro: 'muitas_requisicoes' }],
    [200, {}], // 200 sem código: nunca mostra QR vazio
    [200, { copiaCola: '' }],
  ])('%i %j → indisponível', async (status, corpo) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(status, corpo)))
    expect(await criarPixHttp().gerar(TOKEN)).toEqual({ ok: false, motivo: 'indisponivel' })
  })

  it('rede caiu ou resposta que não é JSON: indisponível (sem lançar)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')))
    expect(await criarPixHttp().gerar(TOKEN)).toEqual({ ok: false, motivo: 'indisponivel' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => Promise.reject(new Error('html')),
      }),
    )
    expect(await criarPixHttp().gerar(TOKEN)).toEqual({ ok: false, motivo: 'indisponivel' })
  })
})

describe('criarPixSimulado', () => {
  it('devolve um código de teste que diz claramente que não é para pagar, com prazo de 30 min', async () => {
    const agora = new Date('2026-09-18T20:00:00Z')
    const r = await criarPixSimulado(() => agora).gerar(TOKEN)
    expect(r.ok && r.copiaCola).toContain('SIMULADO-NAO-PAGAR')
    expect(r.ok && r.expiraEm).toBe('2026-09-18T20:30:00.000Z')
  })
})
