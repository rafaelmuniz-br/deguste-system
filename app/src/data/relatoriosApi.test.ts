import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarRelatoriosSupabase } from './relatoriosApi.ts'

const bruto = {
  periodo: { inicio: '2026-09-10', fim: '2026-09-11' },
  resumo: {
    pedidos: '2',
    receita_centavos: '6198',
    ticket_medio_centavos: '3099',
    cancelados: '0',
  },
  por_dia: [{ dia: '2026-09-10', pedidos: '2', receita_centavos: '6198' }],
  por_canal: [],
  por_tipo: [],
  por_hora: [],
  produtos: [],
}

describe('criarRelatoriosSupabase', () => {
  it('chama a função do banco com as datas e converte o resultado', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: bruto, error: null })
    const r = await criarRelatoriosSupabase({ rpc } as unknown as SupabaseClient).vendas(
      '2026-09-10',
      '2026-09-11',
    )
    expect(rpc).toHaveBeenCalledWith('relatorio_vendas', {
      p_inicio: '2026-09-10',
      p_fim: '2026-09-11',
    })
    expect(r.resumo).toEqual({
      pedidos: 2,
      receitaCentavos: 6198,
      ticketMedioCentavos: 3099,
      cancelados: 0,
    })
    expect(r.porDia).toEqual([{ dia: '2026-09-10', pedidos: 2, receitaCentavos: 6198 }])
  })

  it('erro do banco vira exceção (a tela mostra a mensagem)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'sem_permissao' } })
    await expect(
      criarRelatoriosSupabase({ rpc } as unknown as SupabaseClient).vendas(
        '2026-09-10',
        '2026-09-11',
      ),
    ).rejects.toThrow('sem_permissao')
  })
})
