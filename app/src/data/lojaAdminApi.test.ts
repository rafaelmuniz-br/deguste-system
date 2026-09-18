import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarLojaAdminSupabase, mapearLoja } from './lojaAdminApi.ts'

const linha = {
  nome: 'Deguste Burguer',
  modo: 'automatico' as const,
  endereco: null,
  latitude: null,
  longitude: null,
  frete_base_centavos: 500,
  frete_por_km_centavos: 150,
  raio_maximo_km: '6.50', // numeric chega como texto
  pedido_minimo_centavos: 0,
  tempo_preparo_min: 30,
}

describe('mapearLoja', () => {
  it('converte numeric em número e corta os segundos dos horários', () => {
    const d = mapearLoja(linha, [{ dia_semana: 3, abre: '18:00:00', fecha: '22:00:00' }])
    expect(d.raioMaximoKm).toBe(6.5)
    expect(d.horarios).toEqual([{ dia: 3, abre: '18:00', fecha: '22:00' }])
    expect(d.freteBaseCentavos).toBe(500)
  })
})

/** Cliente falso: `from(tabela)` devolve a resposta daquela tabela. */
function clienteFalso(
  respostas: Record<string, unknown>,
  rpc = vi.fn().mockResolvedValue({ error: null }),
) {
  const from = (tabela: string) => {
    const consulta: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) consulta[m] = () => consulta
    consulta.maybeSingle = () => Promise.resolve(respostas[tabela])
    consulta.then = (resolve: (v: unknown) => unknown) => resolve(respostas[tabela])
    return consulta
  }
  return { cliente: { from, rpc } as unknown as SupabaseClient, rpc }
}

describe('criarLojaAdminSupabase', () => {
  it('carregar junta configuração e horários', async () => {
    const { cliente } = clienteFalso({
      configuracoes_loja: { data: linha, error: null },
      horarios_funcionamento: {
        data: [{ dia_semana: 0, abre: '18:00:00', fecha: '22:00:00' }],
        error: null,
      },
    })
    const d = await criarLojaAdminSupabase(cliente).carregar()
    expect(d.nome).toBe('Deguste Burguer')
    expect(d.horarios).toHaveLength(1)
  })

  it('carregar: erro do banco ou configuração ausente lança', async () => {
    const semLinha = clienteFalso({
      configuracoes_loja: { data: null, error: null },
      horarios_funcionamento: { data: [], error: null },
    })
    await expect(criarLojaAdminSupabase(semLinha.cliente).carregar()).rejects.toThrow(
      /não encontrada/,
    )

    const erro = clienteFalso({
      configuracoes_loja: { data: linha, error: null },
      horarios_funcionamento: { data: null, error: { message: 'rede' } },
    })
    await expect(criarLojaAdminSupabase(erro.cliente).carregar()).rejects.toThrow('rede')
  })

  it('salvar chama UMA função do banco (atômica) com configuração e horários', async () => {
    const { cliente, rpc } = clienteFalso({})
    const r = await criarLojaAdminSupabase(cliente).salvar({
      ...mapearLoja(linha, []),
      horarios: [{ dia: 5, abre: '18:00', fecha: '23:00' }],
    })
    expect(r).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('salvar_configuracao_loja', {
      p_config: expect.objectContaining({
        modo: 'automatico',
        frete_base_centavos: 500,
        raio_maximo_km: 6.5,
        tempo_preparo_min: 30,
      }),
      p_horarios: [{ dia_semana: 5, abre: '18:00', fecha: '23:00' }],
    })
  })

  it('salvar: sem permissão e violação de regra do banco viram frases em português', async () => {
    const semPermissao = clienteFalso({}, vi.fn().mockResolvedValue({ error: { code: '42501' } }))
    expect(
      await criarLojaAdminSupabase(semPermissao.cliente).salvar(mapearLoja(linha, [])),
    ).toEqual({ ok: false, mensagem: expect.stringContaining('Sem permissão') })

    const regra = clienteFalso({}, vi.fn().mockResolvedValue({ error: { code: '23514' } }))
    expect(await criarLojaAdminSupabase(regra.cliente).salvar(mapearLoja(linha, []))).toEqual({
      ok: false,
      mensagem: expect.stringContaining('fora do permitido'),
    })

    const duplicado = clienteFalso({}, vi.fn().mockResolvedValue({ error: { code: '23505' } }))
    expect(await criarLojaAdminSupabase(duplicado.cliente).salvar(mapearLoja(linha, []))).toEqual({
      ok: false,
      mensagem: expect.stringContaining('Já existe'),
    })
  })
})
