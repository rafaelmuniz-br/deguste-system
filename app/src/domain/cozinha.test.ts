import { describe, expect, it } from 'vitest'
import {
  acaoPrincipal,
  agrupar,
  linkDaRota,
  minutosDesde,
  nivelDeAtraso,
  podeCancelar,
  type PedidoCozinha,
} from './cozinha.ts'

const pedido = (over: Partial<PedidoCozinha> = {}): PedidoCozinha => ({
  id: 'p1',
  numero: 1,
  criadoEm: '2026-09-18T21:00:00Z',
  canal: 'proprio',
  tipo: 'entrega',
  status: 'novo',
  clienteNome: 'Maria',
  clienteTelefone: '71999991234',
  totalCentavos: 2000,
  itens: [],
  ...over,
})

describe('agrupar', () => {
  it('separa por coluna e junta "pronto" com "saiu para entrega"', () => {
    const g = agrupar([
      pedido({ id: 'a', status: 'novo' }),
      pedido({ id: 'b', status: 'em_preparo' }),
      pedido({ id: 'c', status: 'pronto' }),
      pedido({ id: 'd', status: 'saiu_para_entrega' }),
    ])
    expect(g.novos.map((p) => p.id)).toEqual(['a'])
    expect(g.preparo.map((p) => p.id)).toEqual(['b'])
    expect(g.prontos.map((p) => p.id)).toEqual(['c', 'd'])
  })

  it('o mais antigo fica no topo de cada coluna', () => {
    const g = agrupar([
      pedido({ id: 'novo-2', criadoEm: '2026-09-18T21:10:00Z' }),
      pedido({ id: 'velho', criadoEm: '2026-09-18T21:00:00Z' }),
      pedido({ id: 'novo-1', criadoEm: '2026-09-18T21:05:00Z' }),
    ])
    expect(g.novos.map((p) => p.id)).toEqual(['velho', 'novo-1', 'novo-2'])
  })

  it('não altera a lista original e ignora status que não aparecem na cozinha', () => {
    const entrada = [
      pedido({ id: 'x', status: 'concluido' }),
      pedido({ id: 'y', status: 'cancelado' }),
    ]
    const copia = JSON.stringify(entrada)
    const g = agrupar(entrada)
    expect(JSON.stringify(entrada)).toBe(copia)
    expect(g.novos.length + g.preparo.length + g.prontos.length).toBe(0)
  })
})

describe('acaoPrincipal: só o próximo passo válido', () => {
  it('novo -> em preparo -> pronto', () => {
    expect(acaoPrincipal({ status: 'novo', tipo: 'entrega' })?.para).toBe('em_preparo')
    expect(acaoPrincipal({ status: 'em_preparo', tipo: 'entrega' })?.para).toBe('pronto')
  })

  it('pronto: entrega sai para entrega; retirada é entregue ao cliente', () => {
    expect(acaoPrincipal({ status: 'pronto', tipo: 'entrega' })?.para).toBe('saiu_para_entrega')
    expect(acaoPrincipal({ status: 'pronto', tipo: 'retirada' })?.para).toBe('concluido')
    expect(acaoPrincipal({ status: 'saiu_para_entrega', tipo: 'entrega' })?.para).toBe('concluido')
  })

  it('pedido terminado ou ainda não pago não tem ação', () => {
    for (const status of ['concluido', 'cancelado', 'aguardando_pagamento'] as const) {
      expect(acaoPrincipal({ status, tipo: 'entrega' })).toBeNull()
    }
  })
})

describe('podeCancelar', () => {
  it('só enquanto está em andamento na cozinha', () => {
    for (const s of ['novo', 'em_preparo', 'pronto', 'saiu_para_entrega'] as const)
      expect(podeCancelar(s)).toBe(true)
    for (const s of ['concluido', 'cancelado', 'aguardando_pagamento'] as const)
      expect(podeCancelar(s)).toBe(false)
  })
})

describe('atraso', () => {
  it('minutosDesde nunca é negativo (relógio adiantado)', () => {
    expect(minutosDesde('2026-09-18T21:00:00Z', new Date('2026-09-18T21:12:30Z'))).toBe(12)
    expect(minutosDesde('2026-09-18T21:10:00Z', new Date('2026-09-18T21:00:00Z'))).toBe(0)
  })

  it('normal até 70% do tempo, atenção até 100%, atrasado depois (tempo de preparo 30 min)', () => {
    expect(nivelDeAtraso('em_preparo', 20, 30)).toBe('ok')
    expect(nivelDeAtraso('em_preparo', 21, 30)).toBe('atencao')
    expect(nivelDeAtraso('novo', 30, 30)).toBe('atencao')
    expect(nivelDeAtraso('novo', 31, 30)).toBe('atrasado')
  })

  it('pedido já pronto ou a caminho não é cobrado como atraso', () => {
    expect(nivelDeAtraso('pronto', 90, 30)).toBe('ok')
    expect(nivelDeAtraso('saiu_para_entrega', 90, 30)).toBe('ok')
  })
})

describe('linkDaRota', () => {
  it('monta o link do Google Maps com o endereço completo e codificado', () => {
    const l = linkDaRota({ rua: 'Rua José Augusto', numero: '506', bairro: 'Praia do Flamengo' })
    expect(l).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent('Rua José Augusto, 506, Praia do Flamengo, Salvador, BA, Brasil'),
    )
  })

  it('sem rua não há rota; o endereço nunca quebra a URL', () => {
    expect(linkDaRota(undefined)).toBeNull()
    expect(linkDaRota({ bairro: 'Pituba' })).toBeNull()
    expect(linkDaRota({ rua: 'Rua A & B #1?x=y', numero: '1' })).not.toMatch(/[& #?](?=[^=]*$)/)
    expect(linkDaRota({ rua: 'Rua A & B', numero: '1' })).toContain('destination=Rua%20A%20%26%20B')
  })
})
