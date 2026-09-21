import { describe, expect, it } from 'vitest'
import {
  BUCKET_FOTOS,
  caminhoDaFoto,
  calcularTamanho,
  caminhoMiniatura,
  LIMITE_ORIGINAL_BYTES,
  validarArquivoFoto,
} from './fotos.ts'

describe('validarArquivoFoto', () => {
  it('aceita JPG, PNG e WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validarArquivoFoto({ type, size: 2_000_000 })).toBeNull()
    }
  })

  it('recusa outros formatos (PDF, GIF, HEIC, SVG)', () => {
    for (const type of ['application/pdf', 'image/gif', 'image/heic', 'image/svg+xml', '']) {
      expect(validarArquivoFoto({ type, size: 1000 })).toMatch(/JPG, PNG ou WebP/)
    }
  })

  it('recusa arquivo vazio e arquivo grande demais', () => {
    expect(validarArquivoFoto({ type: 'image/png', size: 0 })).toMatch(/vazio/)
    expect(validarArquivoFoto({ type: 'image/png', size: LIMITE_ORIGINAL_BYTES + 1 })).toMatch(
      /muito grande/,
    )
    expect(validarArquivoFoto({ type: 'image/png', size: LIMITE_ORIGINAL_BYTES })).toBeNull()
  })
})

describe('calcularTamanho', () => {
  it('reduz mantendo a proporção (lado maior vira 1000)', () => {
    expect(calcularTamanho(4000, 3000)).toEqual({ largura: 1000, altura: 750 })
    expect(calcularTamanho(3000, 4000)).toEqual({ largura: 750, altura: 1000 })
    expect(calcularTamanho(2000, 2000)).toEqual({ largura: 1000, altura: 1000 })
  })

  it('não aumenta foto pequena', () => {
    expect(calcularTamanho(800, 600)).toEqual({ largura: 800, altura: 600 })
    expect(calcularTamanho(1000, 1000)).toEqual({ largura: 1000, altura: 1000 })
  })

  it('nunca devolve dimensão zero (foto muito comprida)', () => {
    expect(calcularTamanho(10000, 3)).toEqual({ largura: 1000, altura: 1 })
  })

  it('aceita outro limite', () => {
    expect(calcularTamanho(1600, 800, 400)).toEqual({ largura: 400, altura: 200 })
  })
})

describe('caminhoDaFoto', () => {
  it('pasta por produto e nome novo a cada envio', () => {
    expect(caminhoDaFoto('p1', new Date(1_700_000_000_000), 'webp')).toBe('p1/1700000000000.webp')
    expect(caminhoDaFoto('p1', new Date(1_700_000_000_001), 'jpg')).toBe('p1/1700000000001.jpg')
  })
})

describe('caminhoMiniatura', () => {
  it('acrescenta -mini antes da extensão', () => {
    expect(caminhoMiniatura('p1/1700.webp')).toBe('p1/1700-mini.webp')
    expect(caminhoMiniatura('p1/1700.jpg')).toBe('p1/1700-mini.jpg')
  })
})

describe('constantes', () => {
  it('o bucket é o mesmo criado pela migration', () => {
    expect(BUCKET_FOTOS).toBe('fotos-produtos')
  })
})
