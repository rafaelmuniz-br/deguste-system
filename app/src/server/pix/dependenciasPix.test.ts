import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarDependenciasPix, expirarPedidosPendentes } from './dependenciasPix.ts'

const ambienteCompleto = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secreta',
  MP_ACCESS_TOKEN: 'token',
  MP_WEBHOOK_SECRET: 'segredo',
  SITE_URL: 'https://deguste.exemplo/',
  PIX_EMAIL_PAGADOR: 'pagamentos@deguste.exemplo',
}

function clienteFalso(respostas: { linha?: unknown; rpc?: unknown } = {}) {
  const consulta: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) consulta[m] = () => consulta
  consulta.maybeSingle = () => Promise.resolve(respostas.linha ?? { data: null, error: null })
  const rpc = vi.fn().mockResolvedValue(respostas.rpc ?? { data: null, error: null })
  const cliente = { from: vi.fn(() => consulta), rpc } as unknown as SupabaseClient
  return { cliente, rpc }
}

describe('criarDependenciasPix', () => {
  it('sem configuração do Supabase: lança só quando usado (a function carrega normalmente)', async () => {
    const dep = criarDependenciasPix({})
    await expect(dep.buscarPedidoPorToken('x')).rejects.toThrow(/Supabase não configurado/)
    await expect(dep.confirmarPagamento('1', 1)).rejects.toThrow(/Supabase não configurado/)
  })

  it('sem configuração do gateway: lança ao usar o gateway, sem vazar nome de variável secreta com valor', () => {
    const dep = criarDependenciasPix({ ...ambienteCompleto, MP_ACCESS_TOKEN: undefined })
    expect(() => dep.gateway).toThrow('Gateway de Pix não configurado no servidor')
  })

  it('com tudo configurado, cria o gateway e a URL do aviso não tem barra dobrada', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 9, point_of_interaction: { transaction_data: { qr_code: 'Q' } } }),
    })
    const dep = criarDependenciasPix(ambienteCompleto, { fetchImpl })
    await dep.gateway.criarCobranca({
      pedidoId: 'p',
      numero: 1,
      valorCentavos: 100,
      expiraEmMinutos: 30,
    })
    const corpo = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(corpo.notification_url).toBe('https://deguste.exemplo/.netlify/functions/webhook-pix')
  })

  it('buscarPedidoPorToken converte a linha (numero bigint chega como texto)', async () => {
    const { cliente } = clienteFalso({
      linha: {
        data: {
          id: 'ped-1',
          numero: '42',
          total_centavos: 3579,
          status: 'aguardando_pagamento',
          pagamento_status: 'pendente',
          pix_copia_cola: null,
          pagamento_expira_em: null,
        },
        error: null,
      },
    })
    const dep = criarDependenciasPix(ambienteCompleto, { criarCliente: () => cliente })
    expect(await dep.buscarPedidoPorToken('t')).toEqual({
      id: 'ped-1',
      numero: 42,
      totalCentavos: 3579,
      status: 'aguardando_pagamento',
      pagamentoStatus: 'pendente',
      pixCopiaCola: null,
      pagamentoExpiraEm: null,
    })
  })

  it('token que não existe devolve null; erro do banco lança', async () => {
    const dep = criarDependenciasPix(ambienteCompleto, {
      criarCliente: () => clienteFalso().cliente,
    })
    expect(await dep.buscarPedidoPorToken('t')).toBeNull()

    const erro = clienteFalso({ linha: { data: null, error: { message: 'rede' } } })
    const dep2 = criarDependenciasPix(ambienteCompleto, { criarCliente: () => erro.cliente })
    await expect(dep2.buscarPedidoPorToken('t')).rejects.toThrow('rede')
  })

  it('registrarCobranca e confirmarPagamento chamam as funções do banco com os parâmetros certos', async () => {
    const { cliente, rpc } = clienteFalso({ rpc: { data: 'registrada', error: null } })
    const dep = criarDependenciasPix(ambienteCompleto, { criarCliente: () => cliente })

    expect(
      await dep.registrarCobranca('ped-1', {
        externoId: 'mp-1',
        copiaCola: 'C',
        expiraEm: '2026-09-18T20:30:00Z',
      }),
    ).toBe('registrada')
    expect(rpc).toHaveBeenCalledWith('registrar_cobranca_pix', {
      p_pedido_id: 'ped-1',
      p_externo_id: 'mp-1',
      p_copia_cola: 'C',
      p_expira_em: '2026-09-18T20:30:00Z',
    })

    rpc.mockResolvedValueOnce({ data: 'confirmado', error: null })
    expect(await dep.confirmarPagamento('mp-1', 3579)).toBe('confirmado')
    expect(rpc).toHaveBeenLastCalledWith('confirmar_pagamento_pix', {
      p_externo_id: 'mp-1',
      p_valor_centavos: 3579,
    })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(dep.confirmarPagamento('mp-1', 1)).rejects.toThrow('boom')
  })
})

describe('expirarPedidosPendentes', () => {
  it('chama a função do banco e devolve quantos pedidos foram cancelados', async () => {
    const { cliente, rpc } = clienteFalso({ rpc: { data: 3, error: null } })
    expect(await expirarPedidosPendentes(ambienteCompleto, { criarCliente: () => cliente })).toBe(3)
    expect(rpc).toHaveBeenCalledWith('expirar_pedidos_pendentes', { p_minutos: 30 })
  })

  it('sem configuração ou com erro do banco: lança', async () => {
    await expect(expirarPedidosPendentes({})).rejects.toThrow(/não configurado/)
    const { cliente } = clienteFalso({ rpc: { data: null, error: { message: 'x' } } })
    await expect(
      expirarPedidosPendentes(ambienteCompleto, { criarCliente: () => cliente }),
    ).rejects.toThrow('x')
  })
})
