import { describe, expect, it } from 'vitest'
import { caminhoDoQr, gerarMatrizQr } from './qr.ts'

const PIX =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913DEGUSTE TESTE6008SALVADOR62070503***6304ABCD'

describe('gerarMatrizQr', () => {
  it('gera matriz quadrada; 21x21 para textos muito curtos (versão 1)', () => {
    const curto = gerarMatrizQr('a')
    expect(curto).toHaveLength(21)
    expect(curto.every((l) => l.length === 21)).toBe(true)
  })

  it('texto de Pix cabe numa versão maior e o tamanho segue a regra 17 + 4×versão', () => {
    const m = gerarMatrizQr(PIX)
    expect(m.length).toBeGreaterThan(21)
    expect((m.length - 17) % 4).toBe(0)
  })

  it('tem os 3 marcadores de canto que os leitores procuram (7x7 com borda escura)', () => {
    const m = gerarMatrizQr(PIX)
    const n = m.length
    for (const [linha, coluna] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      for (let i = 0; i < 7; i++) {
        expect(m[linha][coluna + i]).toBe(true) // topo do marcador
        expect(m[linha + i][coluna]).toBe(true) // lado esquerdo
        expect(m[linha + 6][coluna + i]).toBe(true) // base
        expect(m[linha + i][coluna + 6]).toBe(true) // lado direito
      }
      expect(m[linha + 3][coluna + 3]).toBe(true) // miolo
      expect(m[linha + 1][coluna + 1]).toBe(false) // anel claro
    }
  })

  it('é determinístico: o mesmo código dá o mesmo QR; códigos diferentes, QRs diferentes', () => {
    expect(gerarMatrizQr(PIX)).toEqual(gerarMatrizQr(PIX))
    expect(gerarMatrizQr(PIX)).not.toEqual(gerarMatrizQr(PIX + 'x'))
  })
})

describe('caminhoDoQr', () => {
  it('cada quadrado escuro vira um pedaço do path, na posição certa', () => {
    expect(
      caminhoDoQr([
        [true, false],
        [false, true],
      ]),
    ).toBe('M0 0h1v1h-1zM1 1h1v1h-1z')
  })

  it('matriz toda clara: path vazio', () => {
    expect(caminhoDoQr([[false]])).toBe('')
  })

  it('a quantidade de pedaços é igual à de módulos escuros', () => {
    const m = gerarMatrizQr(PIX)
    const escuros = m.flat().filter(Boolean).length
    expect(caminhoDoQr(m).split('M').length - 1).toBe(escuros)
  })
})
