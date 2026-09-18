import { describe, expect, it } from 'vitest'
import {
  descreverAndamento,
  ehTerminal,
  passoAtual,
  PASSOS,
  type StatusPedido,
} from './andamento.ts'

describe('passoAtual', () => {
  it('entrega percorre os 6 passos na ordem', () => {
    const ordem: StatusPedido[] = [
      'aguardando_pagamento',
      'novo',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'concluido',
    ]
    expect(ordem.map((s) => passoAtual('entrega', s))).toEqual([0, 1, 2, 3, 4, 5])
    expect(PASSOS.entrega).toHaveLength(6)
  })

  it('retirada tem 5 passos: "saiu para entrega" não existe e concluído é o último', () => {
    expect(passoAtual('retirada', 'saiu_para_entrega')).toBe(3)
    expect(passoAtual('retirada', 'concluido')).toBe(PASSOS.retirada.length - 1)
  })

  it('cancelado não tem passo (a tela não mostra a linha do tempo)', () => {
    expect(passoAtual('entrega', 'cancelado')).toBeNull()
  })

  it('todo status válido resolve para um passo dentro do intervalo (ou nulo se cancelado)', () => {
    const todos: StatusPedido[] = [
      'aguardando_pagamento',
      'novo',
      'em_preparo',
      'pronto',
      'saiu_para_entrega',
      'concluido',
      'cancelado',
    ]
    for (const tipo of ['entrega', 'retirada'] as const) {
      for (const s of todos) {
        const p = passoAtual(tipo, s)
        if (s === 'cancelado') expect(p).toBeNull()
        else expect(p).toBeGreaterThanOrEqual(0)
        if (p !== null) expect(p).toBeLessThan(PASSOS[tipo].length)
      }
    }
  })
})

describe('ehTerminal', () => {
  it('só concluído e cancelado param de mudar', () => {
    expect(ehTerminal('concluido')).toBe(true)
    expect(ehTerminal('cancelado')).toBe(true)
    expect(ehTerminal('em_preparo')).toBe(false)
    expect(ehTerminal('aguardando_pagamento')).toBe(false)
  })
})

describe('descreverAndamento', () => {
  it('aguardando pagamento: neutro; Pix expirado ou pagamento falho: alerta claro', () => {
    expect(descreverAndamento('entrega', 'aguardando_pagamento', 'pendente')).toMatchObject({
      alerta: false,
    })
    expect(descreverAndamento('entrega', 'aguardando_pagamento', 'expirado').texto).toMatch(
      /expirou e nada foi cobrado/,
    )
    expect(descreverAndamento('entrega', 'aguardando_pagamento', 'expirado').alerta).toBe(true)
    expect(descreverAndamento('retirada', 'aguardando_pagamento', 'falhou').alerta).toBe(true)
  })

  it('cancelado: alerta que remete à política de cancelamento', () => {
    const m = descreverAndamento('entrega', 'cancelado', 'pago')
    expect(m.alerta).toBe(true)
    expect(m.texto).toMatch(/cancelado/)
  })

  it('o texto muda conforme entrega ou retirada', () => {
    expect(descreverAndamento('entrega', 'pronto', 'pago').texto).toMatch(/entrega/)
    expect(descreverAndamento('retirada', 'pronto', 'pago').texto).toMatch(/retirada/)
    expect(descreverAndamento('entrega', 'concluido', 'pago').texto).toMatch(/entregue/)
    expect(descreverAndamento('retirada', 'concluido', 'pago').texto).toMatch(/retirado/)
  })

  it('retirada com status "saiu para entrega" (não deveria ocorrer) não promete entrega', () => {
    expect(descreverAndamento('retirada', 'saiu_para_entrega', 'pago').texto).not.toMatch(
      /saiu para entrega/,
    )
  })
})
