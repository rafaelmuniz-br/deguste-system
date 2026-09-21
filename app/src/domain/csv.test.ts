import { describe, expect, it } from 'vitest'
import type { PedidoExportado } from '../data/exportacaoApi.ts'
import { celula, centavosParaCsv, gerarCsv } from './csv.ts'
import { nomeDoArquivo, pedidosParaCsv } from './exportarVendas.ts'
import { dataHoraDaBahia } from './relatorios.ts'

describe('celula', () => {
  it('texto simples passa direto; vazio para null/undefined', () => {
    expect(celula('Smash')).toBe('Smash')
    expect(celula(null)).toBe('')
    expect(celula(undefined)).toBe('')
    expect(celula(42)).toBe('42')
  })

  it('escapa separador, aspas e quebra de linha', () => {
    expect(celula('2x Smash; 1x Refri')).toBe('"2x Smash; 1x Refri"')
    expect(celula('ele disse "oi"')).toBe('"ele disse ""oi"""')
    expect(celula('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it.each(['=1+1', '+55 71', '-2+3', '@SOMA(A1)', '=HYPERLINK("http://x")', '\t=cmd'])(
    'INJEÇÃO DE FÓRMULA: %j ganha apóstrofo (a planilha não executa)',
    (perigoso) => {
      const saida = celula(perigoso)
      const semAspas = saida.startsWith('"') ? saida.slice(1, -1).replace(/""/g, '"') : saida
      expect(semAspas.startsWith("'")).toBe(true)
      expect(semAspas.slice(1)).toBe(perigoso)
    },
  )

  it('número de verdade (typeof number) não é tratado como fórmula, mesmo negativo', () => {
    expect(celula(-5)).toBe('-5')
  })

  it('texto normal com = no meio não é alterado', () => {
    expect(celula('a=b')).toBe('a=b')
  })
})

describe('gerarCsv', () => {
  it('BOM UTF-8, separador ";", CRLF e acentos preservados', () => {
    const csv = gerarCsv(
      [{ n: 'Pão' }, { n: 'Café' }],
      [{ titulo: 'Nome', valor: (l: { n: string }) => l.n }],
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('﻿Nome\r\nPão\r\nCafé\r\n')
  })

  it('várias colunas', () => {
    const csv = gerarCsv(
      [{ a: 1, b: 'x' }],
      [
        { titulo: 'A', valor: (l: { a: number; b: string }) => l.a },
        { titulo: 'B', valor: (l) => l.b },
      ],
    )
    expect(csv).toBe('﻿A;B\r\n1;x\r\n')
  })

  it('sem linhas: só o cabeçalho', () => {
    expect(gerarCsv([], [{ titulo: 'A', valor: () => '' }])).toBe('﻿A\r\n')
  })
})

describe('centavosParaCsv', () => {
  it('reais com vírgula e 2 casas', () => {
    expect(centavosParaCsv(3579)).toBe('35,79')
    expect(centavosParaCsv(0)).toBe('0,00')
    expect(centavosParaCsv(5)).toBe('0,05')
    expect(centavosParaCsv(100000)).toBe('1000,00')
  })
})

describe('dataHoraDaBahia', () => {
  it('converte UTC para o horário de Salvador (UTC-3)', () => {
    expect(dataHoraDaBahia('2026-09-10T22:30:00Z')).toBe('10/09/2026 19:30')
    expect(dataHoraDaBahia('2026-09-11T01:30:00Z')).toBe('10/09/2026 22:30')
    expect(dataHoraDaBahia('2026-09-11T03:05:00Z')).toBe('11/09/2026 00:05')
  })
})

describe('pedidosParaCsv (o que sai na planilha)', () => {
  const pedido: PedidoExportado = {
    numero: 42,
    criadoEm: '2026-09-10T22:30:00Z',
    canal: 'proprio',
    tipo: 'entrega',
    status: 'concluido',
    pagamentoStatus: 'pago',
    pagamentoMetodo: 'pix',
    bairro: 'Pituba',
    subtotalCentavos: 3079,
    taxaEntregaCentavos: 500,
    descontoCentavos: 0,
    totalCentavos: 3579,
    itens: '1x Combo Smash; 2x Refrigerante',
  }

  it('cabeçalho e linha com valores em reais, datas de Salvador e nomes legíveis', () => {
    const [cab, linha] = pedidosParaCsv([pedido]).replace('﻿', '').split('\r\n')
    expect(cab).toBe(
      'Pedido;Data e hora (Salvador);Canal;Tipo;Situação;Pagamento;Forma de pagamento;Bairro;Subtotal (R$);Taxa de entrega (R$);Desconto (R$);Total (R$);Itens',
    )
    expect(linha).toBe(
      '42;10/09/2026 19:30;Site próprio;Entrega;Concluído;Pago;pix;Pituba;30,79;5,00;0,00;35,79;"1x Combo Smash; 2x Refrigerante"',
    )
  })

  it('NÃO exporta dado pessoal do cliente (o tipo nem tem esses campos) e neutraliza fórmula nos itens', () => {
    const csv = pedidosParaCsv([
      { ...pedido, itens: '=CMD()', bairro: null, pagamentoMetodo: null },
    ])
    expect(csv).not.toMatch(/telefone|Telefone|Nome do cliente|Rua/)
    expect(csv).toContain("'=CMD()")
    expect(csv).toContain(';;;') // forma de pagamento e bairro vazios
  })

  it('status desconhecido aparece como veio (não some)', () => {
    expect(pedidosParaCsv([{ ...pedido, status: 'novo_status' }])).toContain('novo_status')
  })

  it('nome do arquivo: um dia ou um intervalo', () => {
    expect(nomeDoArquivo('2026-09-10', '2026-09-10')).toBe('pedidos-deguste-2026-09-10.csv')
    expect(nomeDoArquivo('2026-09-01', '2026-09-10')).toBe(
      'pedidos-deguste-2026-09-01_a_2026-09-10.csv',
    )
  })
})
