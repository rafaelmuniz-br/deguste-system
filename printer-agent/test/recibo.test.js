import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { codificar, criarEscPos, semAcentos } from '../src/escpos.js'
import { pedidoDeExemplo } from '../src/exemplo.js'
import { dinheiro, duasColunas, montarRecibo, quebrar } from '../src/recibo.js'
import { textoDoRecibo } from './helpers.js'

describe('escpos: codificação de texto', () => {
  it('ASCII passa direto; acentos do português viram bytes da página CP860', () => {
    assert.deepEqual([...codificar('ok')], [0x6f, 0x6b])
    assert.deepEqual([...codificar('ção')], [0x87, 0x84, 0x6f]) // ç ã o
    assert.deepEqual([...codificar('Á É Ó Ú Â Ê Ô Ã Õ À')].filter((b) => b > 0x7f), [0x86, 0x90, 0x9f, 0x96, 0x8f, 0x89, 0x8c, 0x8e, 0x99, 0x91])
    assert.deepEqual([...codificar('á é í ó ú')].filter((b) => b > 0x7f), [0xa0, 0x82, 0xa1, 0xa2, 0xa3])
  })

  it('caractere que a impressora não conhece vira "?", nunca lixo', () => {
    assert.equal(codificar('😀✓', 'cp860').toString('latin1'), '??')
  })

  it('modo ascii tira os acentos (para impressoras que imprimem símbolos estranhos)', () => {
    assert.equal(semAcentos('Guaraná, ação, Conceição'), 'Guarana, acao, Conceicao')
    assert.equal(codificar('Guaraná', 'ascii').toString('latin1'), 'Guarana')
  })

  it('quebra de linha vira 0x0A e tab vira espaço', () => {
    assert.deepEqual([...codificar('a\nb\tc')], [0x61, 0x0a, 0x62, 0x20, 0x63])
  })
})

describe('escpos: comandos', () => {
  it('iniciar zera a impressora e escolhe a página CP860 (ESC @ e ESC t 3)', () => {
    assert.deepEqual([...criarEscPos().iniciar().bytes()], [0x1b, 0x40, 0x1b, 0x74, 3])
  })

  it('em modo ascii não escolhe página de código', () => {
    assert.deepEqual([...criarEscPos({ acentos: 'ascii' }).iniciar().bytes()], [0x1b, 0x40])
  })

  it('alinhar, negrito, tamanho, avançar e cortar geram os bytes certos', () => {
    const b = [...criarEscPos().alinhar('centro').negrito(true).tamanho(2).avancar(4).cortar().bytes()]
    assert.deepEqual(b, [0x1b, 0x61, 1, 0x1b, 0x45, 1, 0x1d, 0x21, 0x11, 0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 3])
  })

  it('tamanho fica entre 1 e 4', () => {
    assert.deepEqual([...criarEscPos().tamanho(9).bytes()], [0x1d, 0x21, 0x33])
    assert.deepEqual([...criarEscPos().tamanho(0).bytes()], [0x1d, 0x21, 0x00])
  })
})

describe('formatação de texto', () => {
  it('dinheiro: centavos em reais, com vírgula', () => {
    assert.equal(dinheiro(2199), 'R$ 21,99')
    assert.equal(dinheiro(0), 'R$ 0,00')
    assert.equal(dinheiro(6876), 'R$ 68,76')
  })

  it('quebrar respeita a largura e não corta palavra no meio', () => {
    assert.deepEqual(quebrar('Rua José Augusto Tourinho Dantas 506', 20), ['Rua José Augusto', 'Tourinho Dantas 506'])
  })

  it('quebrar corta palavra maior que a linha e preserva quebras de parágrafo', () => {
    assert.deepEqual(quebrar('abcdefghij', 4), ['abcd', 'efgh', 'ij'])
    assert.deepEqual(quebrar('a\nb', 10), ['a', 'b'])
  })

  it('duasColunas alinha esquerda e direita na mesma linha', () => {
    const l = duasColunas('Subtotal', 'R$ 10,00', 30)
    assert.equal(l.length, 30)
    assert.ok(l.startsWith('Subtotal') && l.endsWith('R$ 10,00'))
  })
})

describe('recibo do pedido', () => {
  const ascii = { acentos: 'ascii' }
  const texto = (job = pedidoDeExemplo, opcoes = ascii) => textoDoRecibo(montarRecibo(job, opcoes))

  it('traz número, tipo, itens com escolhas, observações em destaque, cliente, endereço e total', () => {
    const t = texto()
    for (const trecho of [
      'PEDIDO 123',
      '>>> ENTREGA <<<',
      'SITE PROPRIO',
      '2x Combo 3 Smashs 90g',
      '> Smashs: 4x Jackfino',
      '> Smashs: 2x Xeque Mate',
      '> Bebida: 2x Guarana Antarctica Lata',
      '!! SEM CEBOLA',
      '1x Batata frita',
      'OBSERVACAO DO PEDIDO:',
      'TOCAR A CAMPAINHA 2 VEZES',
      'Maria da Conceicao',
      '71999991234',
      'Rua Jose Augusto Tourinho Dantas, 506',
      'Flamengo',
      'Compl.: apto 201',
      'Ref.: portao azul',
      'Subtotal',
      'R$ 58,96',
      'Entrega',
      'R$ 9,80',
      'TOTAL',
      'R$ 68,76',
      'PIX: PAGO',
    ]) {
      assert.ok(t.includes(trecho), `faltou "${trecho}" no recibo:\n${t}`)
    }
  })

  it('retirada não imprime endereço nem taxa de entrega', () => {
    const job = structuredClone(pedidoDeExemplo)
    Object.assign(job.pedido, { tipo: 'retirada', endereco_rua: null, taxa_entrega_centavos: 0, total_centavos: 5896 })
    const t = texto(job)
    assert.ok(t.includes('>>> RETIRADA <<<'))
    assert.ok(!t.includes('Compl.:') && !t.includes('Entrega  '))
    assert.ok(!t.includes('Tourinho'))
  })

  it('reimpressão vem marcada em destaque', () => {
    assert.ok(texto({ ...pedidoDeExemplo, reimpressao: true }).includes('*** REIMPRESSAO ***'))
    assert.ok(!texto().includes('REIMPRESSAO'))
  })

  it('nenhuma linha passa da largura do papel (48 e 32 colunas)', () => {
    for (const largura of [48, 32]) {
      for (const linha of texto(pedidoDeExemplo, { ...ascii, largura }).split('\n')) {
        assert.ok(linha.length <= largura, `linha de ${linha.length} colunas passa de ${largura}: "${linha}"`)
      }
    }
  })

  it('com acentos (CP860) o recibo usa a página de código e os bytes acentuados', () => {
    const bytes = montarRecibo(pedidoDeExemplo)
    assert.ok(bytes.includes(Buffer.from([0x1b, 0x74, 3])), 'deveria selecionar a página CP860')
    assert.ok(bytes.includes(0x87), 'ç em CP860') // "Conceição"
    assert.ok(bytes.includes(0x84), 'ã em CP860')
  })

  it('termina avançando o papel (ESC d 4) e cortando (GS V B 3)', () => {
    const b = montarRecibo(pedidoDeExemplo)
    assert.deepEqual([...b.subarray(-7)], [0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 3])
  })

  it('pedido com muitos itens e observação enorme não estoura nem perde informação', () => {
    const job = structuredClone(pedidoDeExemplo)
    job.pedido.observacoes = 'pedido muito importante '.repeat(20)
    job.itens = Array.from({ length: 15 }, (_, i) => ({ nome: `Item ${i + 1} com nome bem comprido para quebrar linha`, quantidade: 1, observacoes: null, componentes: [] }))
    const t = texto(job)
    assert.ok(t.includes('Item 15'))
    assert.ok(t.split('\n').every((l) => l.length <= 48))
  })
})
