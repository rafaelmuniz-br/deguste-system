import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarCozinhaSupabase, mapearPedido, type LinhaPedido } from './cozinhaApi.ts'

const linha: LinhaPedido = {
  id: 'p1',
  numero: '42', // bigint chega como texto
  created_at: '2026-09-18T21:00:00Z',
  canal: 'proprio',
  tipo: 'entrega',
  status: 'novo',
  cliente_nome: 'Maria',
  cliente_telefone: '71999998888',
  endereco_rua: 'Rua A',
  endereco_numero: '10',
  endereco_bairro: 'Pituba',
  endereco_complemento: null,
  endereco_referencia: 'Perto da padaria',
  observacoes: null,
  total_centavos: 3579,
  itens_pedido: [
    {
      nome: 'Combo Casal',
      quantidade: 1,
      observacoes: 'sem cebola',
      itens_pedido_componentes: [{ grupo_nome: 'Burger', opcao_nome: 'Smash', quantidade: 2 }],
    },
  ],
}

describe('mapearPedido', () => {
  it('converte a linha do banco no pedido da cozinha', () => {
    expect(mapearPedido(linha)).toEqual({
      id: 'p1',
      numero: 42,
      criadoEm: '2026-09-18T21:00:00Z',
      canal: 'proprio',
      tipo: 'entrega',
      status: 'novo',
      clienteNome: 'Maria',
      clienteTelefone: '71999998888',
      endereco: {
        rua: 'Rua A',
        numero: '10',
        bairro: 'Pituba',
        complemento: undefined,
        referencia: 'Perto da padaria',
      },
      observacoes: undefined,
      totalCentavos: 3579,
      itens: [
        {
          nome: 'Combo Casal',
          quantidade: 1,
          observacoes: 'sem cebola',
          componentes: [{ grupo: 'Burger', opcao: 'Smash', quantidade: 2 }],
        },
      ],
    })
  })

  it('retirada não tem endereço e item sem componentes vira lista vazia', () => {
    const p = mapearPedido({
      ...linha,
      tipo: 'retirada',
      endereco_rua: null,
      itens_pedido: [
        { nome: 'X-Burger', quantidade: 2, observacoes: null, itens_pedido_componentes: null },
      ],
    })
    expect(p.endereco).toBeUndefined()
    expect(p.itens[0].componentes).toEqual([])
  })
})

/** Encadeador falso: registra as chamadas e devolve `resposta` no final (é "thenable" como o do Supabase). */
function consultaFalsa(resposta: unknown) {
  const chamadas: [string, unknown[]][] = []
  const consulta: Record<string, unknown> = {}
  for (const metodo of ['select', 'update', 'eq', 'in', 'order']) {
    consulta[metodo] = (...args: unknown[]) => {
      chamadas.push([metodo, args])
      return consulta
    }
  }
  consulta.then = (resolve: (v: unknown) => unknown) => resolve(resposta)
  consulta.maybeSingle = () => Promise.resolve(resposta)
  return { consulta, chamadas }
}

describe('criarCozinhaSupabase', () => {
  it('listar: só pedidos PAGOS em andamento, do mais antigo ao mais novo', async () => {
    const { consulta, chamadas } = consultaFalsa({ data: [linha], error: null })
    const from = vi.fn().mockReturnValue(consulta)
    const api = criarCozinhaSupabase({ from } as unknown as SupabaseClient)

    const lista = await api.listar()

    expect(from).toHaveBeenCalledWith('pedidos')
    expect(chamadas).toContainEqual(['eq', ['pagamento_status', 'pago']])
    expect(chamadas).toContainEqual([
      'in',
      ['status', ['novo', 'em_preparo', 'pronto', 'saiu_para_entrega']],
    ])
    expect(chamadas).toContainEqual(['order', ['created_at', { ascending: true }]])
    expect(lista).toHaveLength(1)
    expect(lista[0].numero).toBe(42)
  })

  it('listar: erro do banco vira exceção (a tela avisa que está desatualizada)', async () => {
    const { consulta } = consultaFalsa({ data: null, error: { message: 'rede caiu' } })
    const api = criarCozinhaSupabase({ from: () => consulta } as unknown as SupabaseClient)
    await expect(api.listar()).rejects.toThrow('rede caiu')
  })

  it('mudarStatus: só atualiza se o status ainda for o esperado (evita sobrescrever outra pessoa)', async () => {
    const { consulta, chamadas } = consultaFalsa({ data: [{ id: 'p1' }], error: null })
    const api = criarCozinhaSupabase({ from: () => consulta } as unknown as SupabaseClient)

    expect(await api.mudarStatus('p1', 'novo', 'em_preparo')).toEqual({ ok: true })
    expect(chamadas).toContainEqual(['update', [{ status: 'em_preparo' }]])
    expect(chamadas).toContainEqual(['eq', ['id', 'p1']])
    expect(chamadas).toContainEqual(['eq', ['status', 'novo']])
  })

  it('mudarStatus: nenhuma linha atualizada = conflito', async () => {
    const { consulta } = consultaFalsa({ data: [], error: null })
    const api = criarCozinhaSupabase({ from: () => consulta } as unknown as SupabaseClient)
    expect(await api.mudarStatus('p1', 'novo', 'em_preparo')).toEqual({
      ok: false,
      motivo: 'conflito',
    })
  })

  it('mudarStatus: erro do banco = erro; cancelamento grava o motivo', async () => {
    const falha = consultaFalsa({ data: null, error: { message: 'x' } })
    const apiFalha = criarCozinhaSupabase({
      from: () => falha.consulta,
    } as unknown as SupabaseClient)
    expect(await apiFalha.mudarStatus('p1', 'novo', 'cancelado', 'sem estoque')).toEqual({
      ok: false,
      motivo: 'erro',
    })
    expect(falha.chamadas).toContainEqual([
      'update',
      [{ status: 'cancelado', motivo_cancelamento: 'sem estoque' }],
    ])
  })

  it('tempoPreparoMin lê a configuração da loja; sem configuração, lança', async () => {
    const ok = consultaFalsa({ data: { tempo_preparo_min: 40 }, error: null })
    const api = criarCozinhaSupabase({ from: () => ok.consulta } as unknown as SupabaseClient)
    expect(await api.tempoPreparoMin()).toBe(40)

    const vazio = consultaFalsa({ data: null, error: null })
    const apiVazia = criarCozinhaSupabase({
      from: () => vazio.consulta,
    } as unknown as SupabaseClient)
    await expect(apiVazia.tempoPreparoMin()).rejects.toThrow()
  })

  it('reimprimir chama a função do banco e devolve se deu certo', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { message: 'x' },
      })
    const api = criarCozinhaSupabase({ rpc } as unknown as SupabaseClient)
    expect(await api.reimprimir('p1')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('reimprimir_pedido', { p_pedido_id: 'p1' })
    expect(await api.reimprimir('p1')).toBe(false)
  })

  it('problemasImpressao converte o número (bigint como texto)', async () => {
    const { consulta } = consultaFalsa({
      data: [{ numero: '7', status: 'falhou', erro: 'sem papel' }],
      error: null,
    })
    const api = criarCozinhaSupabase({ from: () => consulta } as unknown as SupabaseClient)
    expect(await api.problemasImpressao()).toEqual([
      { numero: 7, status: 'falhou', erro: 'sem papel' },
    ])
  })

  it('assinar: escuta pedidos e impressões, traduz o estado da conexão e desliga o canal', () => {
    const eventos: string[] = []
    let aoStatus: (s: string) => void = () => {}
    const canal = {
      on(_tipo: string, filtro: { table: string }, _cb: () => void) {
        eventos.push(filtro.table)
        return canal
      },
      subscribe(cb: (s: string) => void) {
        aoStatus = cb
        return canal
      },
    }
    const removeChannel = vi.fn()
    const cliente = { channel: () => canal, removeChannel } as unknown as SupabaseClient
    const conexoes: string[] = []

    const desligar = criarCozinhaSupabase(cliente).assinar(
      () => {},
      (c) => conexoes.push(c),
    )
    aoStatus('SUBSCRIBED')
    aoStatus('CHANNEL_ERROR')
    aoStatus('JOINING')
    desligar()

    expect(eventos).toEqual(['pedidos', 'impressoes'])
    expect(conexoes).toEqual(['conectado', 'desconectado', 'conectando'])
    expect(removeChannel).toHaveBeenCalledWith(canal)
  })
})
