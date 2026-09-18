import { describe, expect, it } from 'vitest'
import { calcularPedido } from '../domain/pedido.ts'
import { montarCardapio, type DadosDoBanco } from './supabaseRepo.ts'

// Linhas no formato que a API do Supabase devolve (conferido no banco de desenvolvimento).
const CAT_SMASH = '00000000-0000-4000-8000-000000000002'
const CAT_OFERTAS = '00000000-0000-4000-8000-000000000001'

function dados(over: Partial<DadosDoBanco> = {}): DadosDoBanco {
  return {
    categorias: [
      { id: CAT_SMASH, nome: 'Smashs', descricao: null, ordem: 2 },
      { id: CAT_OFERTAS, nome: 'Ofertas', descricao: 'Combos', ordem: 1 },
    ],
    produtos: [
      {
        id: 'p-smash',
        categoria_id: CAT_SMASH,
        nome: 'Smash Exemplo',
        descricao: null,
        preco_centavos: 2199,
        preco_original_centavos: 2799,
        foto_path: null,
        eh_combo: false,
        disponivel: true,
        ordem: 1,
        grupos_opcao: [
          {
            id: 'g-adic',
            nome: 'Adicionais',
            min_escolhas: 0,
            max_escolhas: 3,
            ordem: 1,
            opcoes: [
              {
                id: 'o-queijo',
                nome: 'Queijo extra',
                preco_adicional_centavos: 300,
                produto_id: null,
                disponivel: true,
                ordem: 2,
              },
              {
                id: 'o-bacon',
                nome: 'Bacon extra',
                preco_adicional_centavos: 400,
                produto_id: null,
                disponivel: true,
                ordem: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'p-combo',
        categoria_id: CAT_OFERTAS,
        nome: 'Combo Exemplo',
        descricao: 'Escolha um hambúrguer',
        preco_centavos: 3999,
        preco_original_centavos: null,
        foto_path: null,
        eh_combo: true,
        disponivel: true,
        ordem: 1,
        grupos_opcao: [
          {
            id: 'g-ham',
            nome: 'Escolha seu hambúrguer',
            min_escolhas: 1,
            max_escolhas: 1,
            ordem: 1,
            opcoes: [
              {
                id: 'o-smash',
                nome: 'Smash Exemplo',
                preco_adicional_centavos: 0,
                produto_id: 'p-smash',
                disponivel: true,
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
    loja: {
      nome: 'Deguste Burguer',
      fuso_horario: 'America/Bahia',
      modo: 'automatico',
      latitude: null,
      longitude: null,
      frete_base_centavos: 500,
      frete_por_km_centavos: 150,
      raio_maximo_km: '6.00', // numeric pode vir como texto
      pedido_minimo_centavos: 0,
      tempo_preparo_min: 30,
    },
    horarios: [{ dia_semana: 5, abre: '18:00:00', fecha: '22:00:00' }],
    ...over,
  }
}

describe('montarCardapio', () => {
  it('foto do produto vira o endereço público do bucket; sem foto, sem endereço (usa o marcador)', () => {
    const d = dados()
    d.produtos[0].foto_path = 'p-smash/1700.webp'
    const c = montarCardapio(d, (caminho) => `https://x.supabase.co/fotos/${caminho}`)
    expect(c.produtos.find((p) => p.id === 'p-smash')?.fotoUrl).toBe(
      'https://x.supabase.co/fotos/p-smash/1700.webp',
    )
    expect(c.produtos.filter((p) => p.id !== 'p-smash').every((p) => p.fotoUrl === undefined)).toBe(
      true,
    )
    // sem resolvedor de URL o cardápio não quebra
    expect(montarCardapio(d).produtos.every((p) => p.fotoUrl === undefined)).toBe(true)
  })
  it('converte nomes, tipos e trata nulos', () => {
    const c = montarCardapio(dados())
    const smash = c.produtos.find((p) => p.id === 'p-smash')
    expect(smash).toMatchObject({
      categoriaId: CAT_SMASH,
      precoCentavos: 2199,
      precoOriginalCentavos: 2799,
      ehCombo: false,
      descricao: undefined,
      fotoUrl: undefined,
    })
    expect(c.categorias[0]).toMatchObject({ nome: 'Ofertas', descricao: 'Combos' })
    expect(c.categorias[1].descricao).toBeUndefined()
  })

  it('preço original nulo (sem desconto) vira undefined', () => {
    const c = montarCardapio(dados())
    const combo = c.produtos.find((p) => p.id === 'p-combo')
    expect(combo?.precoOriginalCentavos).toBeUndefined()
  })

  it('ordena categorias, produtos, grupos e opções pela coluna ordem', () => {
    const c = montarCardapio(dados())
    expect(c.categorias.map((x) => x.nome)).toEqual(['Ofertas', 'Smashs'])
    const opcoes = c.produtos.find((p) => p.id === 'p-smash')?.grupos[0].opcoes.map((o) => o.nome)
    expect(opcoes).toEqual(['Bacon extra', 'Queijo extra'])
  })

  it('guarda o produto real escolhido dentro do combo', () => {
    const c = montarCardapio(dados())
    const opcao = c.produtos.find((p) => p.id === 'p-combo')?.grupos[0].opcoes[0]
    expect(opcao?.produtoId).toBe('p-smash')
  })

  it('descarta produto cuja categoria o público não enxerga (inativa)', () => {
    const d = dados()
    d.categorias = d.categorias.filter((c) => c.id !== CAT_OFERTAS)
    const c = montarCardapio(d)
    expect(c.produtos.map((p) => p.id)).toEqual(['p-smash'])
  })

  it('produto sem grupos vindo como null vira lista vazia', () => {
    const d = dados()
    d.produtos[0].grupos_opcao = null
    expect(montarCardapio(d).produtos.find((p) => p.id === 'p-smash')?.grupos).toEqual([])
  })

  it('monta a zona de entrega (raio numérico e origem só se houver coordenadas)', () => {
    const sem = montarCardapio(dados()).loja.entrega
    expect(sem.raioMaximoKm).toBe(6)
    expect(sem.origem).toBeUndefined()
    expect(sem.regra).toEqual({ tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 })

    const d = dados()
    d.loja.latitude = -13
    d.loja.longitude = -38.5
    expect(montarCardapio(d).loja.entrega.origem).toEqual({ latitude: -13, longitude: -38.5 })
  })

  it('converte os horários', () => {
    expect(montarCardapio(dados()).loja.horarios).toEqual([
      { diaSemana: 5, abre: '18:00:00', fecha: '22:00:00' },
    ])
  })

  it('o cardápio montado funciona de ponta a ponta na lógica de pedido do servidor', async () => {
    const cardapio = montarCardapio(dados())
    const r = await calcularPedido(
      {
        cliente: { nome: 'Maria Silva', telefone: '71999991234' },
        tipo: 'entrega',
        endereco: { rua: 'Rua A', numero: '1', bairro: 'Pituba' },
        itens: [
          { produtoId: 'p-combo', quantidade: 1, escolhas: { 'g-ham': ['o-smash'] } },
          { produtoId: 'p-smash', quantidade: 2, escolhas: { 'g-adic': ['o-bacon'] } },
        ],
      },
      {
        cardapio,
        agora: new Date('2026-09-18T21:30:00Z'), // sexta 18:30 na Bahia
        resolverDistanciaKm: async () => 2,
      },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      // 3999 + (2199 + 400) x 2 = 9197; frete 500 + 150 x 2 = 800
      expect(r.pedido.subtotalCentavos).toBe(9197)
      expect(r.pedido.totalCentavos).toBe(9197 + 800)
    }
  })
})
