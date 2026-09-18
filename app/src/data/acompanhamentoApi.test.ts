import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  criarAcompanhamentoSimulado,
  criarAcompanhamentoSupabase,
  registrarPedidoSimulado,
} from './acompanhamentoApi.ts'

const TOKEN = '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f'
const clienteCom = (rpc: unknown) => ({ rpc }) as unknown as SupabaseClient

describe('criarAcompanhamentoSupabase', () => {
  it('converte a linha do banco no pedido acompanhado (bigint chega como texto)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          numero: '1234',
          tipo: 'entrega',
          status: 'em_preparo',
          pagamento_status: 'pago',
          total_centavos: 3579,
          criado_em: '2026-09-18T20:00:00Z',
        },
      ],
      error: null,
    })
    const r = await criarAcompanhamentoSupabase(clienteCom(rpc)).buscar(TOKEN)
    expect(rpc).toHaveBeenCalledWith('acompanhar_pedido', { p_token: TOKEN })
    expect(r).toEqual({
      ok: true,
      pedido: {
        numero: 1234,
        tipo: 'entrega',
        status: 'em_preparo',
        pagamentoStatus: 'pago',
        totalCentavos: 3579,
        criadoEm: '2026-09-18T20:00:00Z',
      },
    })
  })

  it('token que não parece um UUID nem chega ao banco', async () => {
    const rpc = vi.fn()
    const api = criarAcompanhamentoSupabase(clienteCom(rpc))
    for (const ruim of ['', 'abc', '../../etc', "' or 1=1 --", TOKEN + 'x']) {
      expect(await api.buscar(ruim)).toEqual({ ok: false, motivo: 'nao_encontrado' })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('token válido sem pedido: não encontrado', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await criarAcompanhamentoSupabase(clienteCom(rpc)).buscar(TOKEN)).toEqual({
      ok: false,
      motivo: 'nao_encontrado',
    })
  })

  it('erro do banco, exceção e cliente ausente: indisponível (nunca "não encontrado")', async () => {
    expect(
      await criarAcompanhamentoSupabase(
        clienteCom(vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } })),
      ).buscar(TOKEN),
    ).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(
      await criarAcompanhamentoSupabase(
        clienteCom(vi.fn().mockRejectedValue(new Error('rede'))),
      ).buscar(TOKEN),
    ).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(await criarAcompanhamentoSupabase(null).buscar(TOKEN)).toEqual({
      ok: false,
      motivo: 'indisponivel',
    })
  })
})

describe('acompanhamento simulado (só desenvolvimento)', () => {
  beforeEach(() => localStorage.clear())

  it('o status avança a cada 15 s: pagamento, fila, preparo, pronto, concluído', async () => {
    let agora = 1_000_000
    registrarPedidoSimulado(TOKEN, { numero: 7, tipo: 'retirada', totalCentavos: 800 }, () => agora)
    const api = criarAcompanhamentoSimulado(() => agora)
    const statusEm = async (segundos: number) => {
      agora = 1_000_000 + segundos * 1000
      const r = await api.buscar(TOKEN)
      return r.ok ? [r.pedido.status, r.pedido.pagamentoStatus] : r
    }
    expect(await statusEm(0)).toEqual(['aguardando_pagamento', 'pendente'])
    expect(await statusEm(15)).toEqual(['novo', 'pago'])
    expect(await statusEm(30)).toEqual(['em_preparo', 'pago'])
    expect(await statusEm(45)).toEqual(['pronto', 'pago'])
    expect(await statusEm(60)).toEqual(['concluido', 'pago'])
    expect(await statusEm(9999)).toEqual(['concluido', 'pago']) // não passa do fim
  })

  it('token desconhecido: não encontrado', async () => {
    expect(
      await criarAcompanhamentoSimulado().buscar('00000000-0000-4000-8000-000000000000'),
    ).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })
})
