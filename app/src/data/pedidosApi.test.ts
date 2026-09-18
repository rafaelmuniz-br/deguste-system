import { afterEach, describe, expect, it, vi } from 'vitest'
import { formularioVazio, montarPedidoBruto } from '../domain/formularioPedido.ts'
import { cardapioExemplo } from './exemplo.ts'
import { criarApiHttp, criarApiSimulada } from './pedidosApi.ts'

const linha = {
  id: 'l1',
  produtoId: 'smash-jackfino',
  quantidade: 2,
  escolhas: { 'smash-jackfino-adicionais': ['smash-jackfino-bacon'] },
  observacao: 'sem cebola',
}

const form = {
  ...formularioVazio,
  nome: 'Maria Silva',
  telefone: '(71) 99999-1234',
  tipo: 'entrega' as const,
  rua: 'Rua das Flores',
  numero: '10',
  bairro: 'Pituba',
}

describe('montarPedidoBruto', () => {
  it('envia só o que o cliente quer: nunca preço, frete nem total', () => {
    const bruto = montarPedidoBruto(form, [{ ...linha }])
    expect(JSON.stringify(bruto)).not.toMatch(/preco|total|taxa|frete|subtotal/i)
    expect(bruto.itens).toEqual([
      {
        produtoId: 'smash-jackfino',
        quantidade: 2,
        escolhas: { 'smash-jackfino-adicionais': ['smash-jackfino-bacon'] },
        observacao: 'sem cebola',
      },
    ])
  })

  it('retirada não envia endereço', () => {
    expect(montarPedidoBruto({ ...form, tipo: 'retirada' }, [linha]).endereco).toBeUndefined()
  })

  it('não vaza campos calculados que porventura estejam na linha da sacola', () => {
    const suja = { ...linha, precoUnitarioCentavos: 1, totalCentavos: 1 }
    expect(JSON.stringify(montarPedidoBruto(form, [suja]))).not.toMatch(/Centavos/)
  })
})

describe('criarApiSimulada', () => {
  const abertaAgora = () => new Date('2026-09-18T21:30:00Z')

  it('calcula com a mesma lógica do servidor e numera os pedidos confirmados', async () => {
    const api = criarApiSimulada(cardapioExemplo, abertaAgora)
    const bruto = montarPedidoBruto(form, [linha])
    const calculo = await api.calcular(bruto)
    expect(calculo.ok && calculo.pedido.totalCentavos).toBe((2199 + 400) * 2 + 980)

    const a = await api.confirmar(bruto)
    const b = await api.confirmar(bruto)
    expect(a.ok && a.numero).toBe(1001)
    expect(b.ok && b.numero).toBe(1002)
  })

  it('não numera pedido recusado', async () => {
    const api = criarApiSimulada(cardapioExemplo, abertaAgora)
    const recusado = await api.confirmar(montarPedidoBruto({ ...form, bairro: 'Paripe' }, [linha]))
    expect(recusado.ok).toBe(false)
    const ok = await api.confirmar(montarPedidoBruto(form, [linha]))
    expect(ok.ok && ok.numero).toBe(1001)
  })

  it('recusa lixo vindo do navegador sem estourar', async () => {
    const api = criarApiSimulada(cardapioExemplo, abertaAgora)
    expect((await api.calcular(null)).ok).toBe(false)
    expect((await api.calcular({ itens: 'x' })).ok).toBe(false)
  })
})

describe('criarApiHttp', () => {
  afterEach(() => vi.unstubAllGlobals())

  const brutoQualquer = montarPedidoBruto(form, [linha])

  it('envia a ação e o pedido e devolve a resposta do servidor', async () => {
    const resposta = { ok: false, erros: [{ codigo: 'LOJA_FECHADA', mensagem: 'fechada' }] }
    const fetchFalso = vi.fn().mockResolvedValue({ json: async () => resposta })
    vi.stubGlobal('fetch', fetchFalso)

    const r = await criarApiHttp('/x').confirmar(brutoQualquer)
    expect(r).toEqual(resposta)
    const [url, init] = fetchFalso.mock.calls[0]
    expect(url).toBe('/x')
    expect(JSON.parse(init.body)).toMatchObject({ acao: 'confirmar', pedido: { tipo: 'entrega' } })
  })

  it('rede fora do ar vira erro amigável, sem estourar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const r = await criarApiHttp().calcular(brutoQualquer)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros[0].codigo).toBe('SERVIDOR_INDISPONIVEL')
  })

  it('resposta que não segue o contrato é tratada como erro do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ qualquer: 'coisa' }) }))
    const r = await criarApiHttp().calcular(brutoQualquer)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros[0].codigo).toBe('SERVIDOR_INDISPONIVEL')
  })
})
