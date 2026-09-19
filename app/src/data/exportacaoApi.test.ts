import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { criarExportacaoSupabase, LIMITE_LINHAS } from './exportacaoApi.ts'

type Chamada = [string, unknown[]]

function clienteFalso(resposta: unknown) {
  const chamadas: Chamada[] = []
  const consulta: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lt', 'order', 'limit']) {
    consulta[m] = (...args: unknown[]) => {
      chamadas.push([m, args])
      return consulta
    }
  }
  consulta.then = (resolve: (v: unknown) => unknown) => resolve(resposta)
  return { cliente: { from: () => consulta } as unknown as SupabaseClient, chamadas }
}

const linha = (numero: number | string = '7') => ({
  numero,
  created_at: '2026-09-10T22:30:00Z',
  canal: 'proprio',
  tipo: 'retirada',
  status: 'concluido',
  pagamento_status: 'pago',
  pagamento_metodo: 'pix',
  endereco_bairro: null,
  subtotal_centavos: 2199,
  taxa_entrega_centavos: 0,
  desconto_centavos: 0,
  total_centavos: 2199,
  itens_pedido: [
    { nome: 'Smash', quantidade: 2 },
    { nome: 'Refri', quantidade: 1 },
  ],
})

describe('criarExportacaoSupabase', () => {
  it('filtra pelo dia inteiro no fuso da Bahia (00:00 do início até 00:00 do dia seguinte ao fim)', async () => {
    const { cliente, chamadas } = clienteFalso({ data: [linha()], error: null })
    await criarExportacaoSupabase(cliente).pedidos('2026-09-10', '2026-09-30')
    expect(chamadas).toContainEqual(['gte', ['created_at', '2026-09-10T00:00:00-03:00']])
    expect(chamadas).toContainEqual(['lt', ['created_at', '2026-10-01T00:00:00-03:00']])
  })

  it('o dia seguinte atravessa mês e ano', async () => {
    const { cliente, chamadas } = clienteFalso({ data: [], error: null })
    await criarExportacaoSupabase(cliente).pedidos('2026-12-31', '2026-12-31')
    expect(chamadas).toContainEqual(['lt', ['created_at', '2027-01-01T00:00:00-03:00']])
  })

  it('NÃO pede nome, telefone nem rua do cliente ao banco', async () => {
    const { cliente, chamadas } = clienteFalso({ data: [], error: null })
    await criarExportacaoSupabase(cliente).pedidos('2026-09-10', '2026-09-10')
    const colunas = String(chamadas.find(([m]) => m === 'select')![1][0])
    expect(colunas).not.toMatch(
      /cliente_nome|cliente_telefone|endereco_rua|endereco_numero|referencia|complemento|observacoes/,
    )
    expect(colunas).toContain('endereco_bairro')
  })

  it('converte a linha (bigint como texto) e resume os itens', async () => {
    const { cliente } = clienteFalso({ data: [linha('7')], error: null })
    const [p] = await criarExportacaoSupabase(cliente).pedidos('2026-09-10', '2026-09-10')
    expect(p).toMatchObject({
      numero: 7,
      totalCentavos: 2199,
      itens: '2x Smash; 1x Refri',
      bairro: null,
      pagamentoMetodo: 'pix',
    })
  })

  it('pedido sem itens vira texto vazio', async () => {
    const { cliente } = clienteFalso({ data: [{ ...linha(), itens_pedido: null }], error: null })
    const [p] = await criarExportacaoSupabase(cliente).pedidos('2026-09-10', '2026-09-10')
    expect(p.itens).toBe('')
  })

  it('período grande demais: recusa em vez de exportar cortado sem avisar', async () => {
    const muitas = Array.from({ length: LIMITE_LINHAS + 1 }, (_, i) => linha(i + 1))
    const { cliente } = clienteFalso({ data: muitas, error: null })
    await expect(
      criarExportacaoSupabase(cliente).pedidos('2026-01-01', '2026-12-31'),
    ).rejects.toThrow(/Mais de 5000 pedidos/)
  })

  it('erro do banco lança', async () => {
    const { cliente } = clienteFalso({ data: null, error: { message: 'sem permissão' } })
    await expect(
      criarExportacaoSupabase(cliente).pedidos('2026-09-10', '2026-09-10'),
    ).rejects.toThrow('sem permissão')
  })
})
