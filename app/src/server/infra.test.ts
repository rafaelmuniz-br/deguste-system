import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { montarCardapio, type DadosDoBanco } from '../data/supabaseRepo.ts'
import { criarDependenciasReais } from './dependenciasReais.ts'
import { criarProvedorDistanciaOrs } from './distanciaOrs.ts'
import { criarLimitador } from './limitador.ts'

describe('limitador', () => {
  it('libera até o máximo na janela e volta a liberar depois dela', () => {
    let t = 0
    const permitir = criarLimitador({ max: 2, janelaMs: 1000, agora: () => t })
    expect(permitir('a')).toBe(true)
    expect(permitir('a')).toBe(true)
    expect(permitir('a')).toBe(false)
    expect(permitir('b')).toBe(true) // outra chave não é afetada
    t = 1001
    expect(permitir('a')).toBe(true)
  })

  it('tentativa barrada não estende o bloqueio', () => {
    let t = 0
    const permitir = criarLimitador({ max: 1, janelaMs: 1000, agora: () => t })
    permitir('a')
    t = 900
    expect(permitir('a')).toBe(false)
    t = 1001 // 1s depois da PRIMEIRA, não da tentativa barrada
    expect(permitir('a')).toBe(true)
  })
})

describe('distância via OpenRouteService', () => {
  const origem = { latitude: -13.0, longitude: -38.5 }
  const endereco = { rua: 'Rua A', numero: '10', bairro: 'Pituba' }
  const resposta = (dados: unknown, ok = true) => ({ ok, json: async () => dados }) as Response

  it('geocodifica, pede a rota e devolve km com 2 casas', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(
        resposta({ features: [{ geometry: { coordinates: [-38.45, -13.02] } }] }),
      )
      .mockResolvedValueOnce(resposta({ routes: [{ summary: { distance: 3456.7 } }] }))
    const distancia = criarProvedorDistanciaOrs({ apiKey: 'chave-secreta', fetchImpl: fetchFalso })
    expect(await distancia(origem, endereco)).toBe(3.46)

    const [urlGeo, initGeo] = fetchFalso.mock.calls[0]
    expect(urlGeo).toContain('geocode/search')
    expect(urlGeo).toContain('Pituba')
    expect(urlGeo).not.toContain('chave-secreta') // a chave NUNCA vai na URL
    expect(initGeo.headers.Authorization).toBe('chave-secreta')
    const corpoRota = JSON.parse(fetchFalso.mock.calls[1][1].body)
    expect(corpoRota.coordinates).toEqual([
      [-38.5, -13.0], // [longitude, latitude] da loja
      [-38.45, -13.02], // destino
    ])
  })

  it.each([
    ['sem chave', { apiKey: undefined }, origem],
    ['loja sem coordenadas', { apiKey: 'k' }, undefined],
  ])('%s: devolve null sem chamar a rede', async (_nome, opcoes, o) => {
    const fetchFalso = vi.fn()
    const distancia = criarProvedorDistanciaOrs({ ...opcoes, fetchImpl: fetchFalso })
    expect(await distancia(o, endereco)).toBeNull()
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('endereço não encontrado, erro HTTP, JSON quebrado e rede fora: sempre null (nunca chuta preço)', async () => {
    const casos: (() => Promise<Response>)[] = [
      async () => resposta({ features: [] }),
      async () => resposta({}, false),
      async () => resposta({ features: [{ geometry: { coordinates: ['x', 'y'] } }] }),
      async () => {
        throw new Error('offline')
      },
    ]
    for (const caso of casos) {
      const distancia = criarProvedorDistanciaOrs({
        apiKey: 'k',
        fetchImpl: vi.fn().mockImplementation(caso),
      })
      expect(await distancia(origem, endereco)).toBeNull()
    }
  })

  it('rota sem distância válida: null', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(
        resposta({ features: [{ geometry: { coordinates: [-38.45, -13.02] } }] }),
      )
      .mockResolvedValueOnce(resposta({ routes: [{ summary: { distance: -5 } }] }))
    expect(
      await criarProvedorDistanciaOrs({ apiKey: 'k', fetchImpl: fetchFalso })(origem, endereco),
    ).toBeNull()
  })
})

describe('dependências reais', () => {
  const clienteFalso = (rpc: unknown) => ({ rpc }) as unknown as SupabaseClient

  it('sem configuração do Supabase: falha ao usar, sem vazar segredo', async () => {
    const deps = criarDependenciasReais({})
    await expect(deps.carregarCardapio()).rejects.toThrow('Supabase não configurado')
    await expect(deps.criarPedidoNoBanco({} as never)).rejects.toThrow('Supabase não configurado')
  })

  it('chama criar_pedido com o payload e converte a resposta', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ o_id: 'i', o_numero: '77', o_token: 'tok' }], error: null })
    const criarCliente = vi.fn().mockReturnValue(clienteFalso(rpc))
    const deps = criarDependenciasReais(
      { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'segredo' },
      { criarCliente },
    )
    const linhas = { pedido: {}, itens: [], componentes: [] } as never
    expect(await deps.criarPedidoNoBanco(linhas)).toEqual({ numero: 77, token: 'tok' })
    expect(rpc).toHaveBeenCalledWith('criar_pedido', { p: linhas })
    expect(criarCliente).toHaveBeenCalledWith('https://x.supabase.co', 'segredo')
  })

  it('erro do banco vira Error com a mensagem; resposta sem token é recusada', async () => {
    const criar = (rpc: unknown) =>
      criarDependenciasReais(
        { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
        { criarCliente: () => clienteFalso(rpc) },
      )
    await expect(
      criar(
        vi.fn().mockResolvedValue({ data: null, error: { message: 'totais_inconsistentes' } }),
      ).criarPedidoNoBanco({} as never),
    ).rejects.toThrow('totais_inconsistentes')
    await expect(
      criar(vi.fn().mockResolvedValue({ data: [], error: null })).criarPedidoNoBanco({} as never),
    ).rejects.toThrow('inesperada')
  })
})

describe('cardápio lido com a service role (ignora o RLS)', () => {
  it('itens inativos NÃO entram no cardápio que o servidor usa para vender', () => {
    const dados: DadosDoBanco = {
      categorias: [
        { id: 'c1', nome: 'Ativa', descricao: null, ordem: 1, ativo: true },
        { id: 'c2', nome: 'Inativa', descricao: null, ordem: 2, ativo: false },
      ],
      produtos: [
        {
          id: 'p1',
          ativo: true,
          categoria_id: 'c1',
          nome: 'Vende',
          descricao: null,
          preco_centavos: 1000,
          preco_original_centavos: null,
          foto_path: null,
          eh_combo: false,
          disponivel: true,
          ordem: 1,
          grupos_opcao: [
            {
              id: 'g',
              nome: 'G',
              min_escolhas: 0,
              max_escolhas: 2,
              ordem: 1,
              opcoes: [
                {
                  id: 'o1',
                  ativo: true,
                  nome: 'Boa',
                  preco_adicional_centavos: 0,
                  produto_id: null,
                  disponivel: true,
                  ordem: 1,
                },
                {
                  id: 'o2',
                  ativo: false,
                  nome: 'Escondida',
                  preco_adicional_centavos: 0,
                  produto_id: null,
                  disponivel: true,
                  ordem: 2,
                },
              ],
            },
          ],
        },
        {
          id: 'p2',
          ativo: false,
          categoria_id: 'c1',
          nome: 'Escondido',
          descricao: null,
          preco_centavos: 1,
          preco_original_centavos: null,
          foto_path: null,
          eh_combo: false,
          disponivel: true,
          ordem: 2,
          grupos_opcao: null,
        },
        {
          id: 'p3',
          ativo: true,
          categoria_id: 'c2',
          nome: 'Em categoria inativa',
          descricao: null,
          preco_centavos: 1,
          preco_original_centavos: null,
          foto_path: null,
          eh_combo: false,
          disponivel: true,
          ordem: 3,
          grupos_opcao: null,
        },
      ],
      loja: {
        nome: 'L',
        fuso_horario: 'America/Bahia',
        modo: 'automatico',
        latitude: null,
        longitude: null,
        frete_base_centavos: 0,
        frete_por_km_centavos: 0,
        raio_maximo_km: 5,
        pedido_minimo_centavos: 0,
        tempo_preparo_min: 30,
      },
      horarios: [],
    }
    const c = montarCardapio(dados)
    expect(c.categorias.map((x) => x.id)).toEqual(['c1'])
    expect(c.produtos.map((x) => x.id)).toEqual(['p1'])
    expect(c.produtos[0].grupos[0].opcoes.map((o) => o.id)).toEqual(['o1'])
  })
})
