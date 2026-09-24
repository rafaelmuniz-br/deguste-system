/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Auditoria de contraste de cor (WCAG 2.1): confere os PARES de cores realmente usados no tema fixo,
// lendo os tokens direto do CSS. Texto: mínimo 4,5:1 (AA). Bordas e foco de
// componentes de interface: mínimo 3:1 (critério 1.4.11).

const css = readFileSync(resolve(process.cwd(), 'src/cardapio.css'), 'utf8')

function lerTokens(bloco: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const m of bloco.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2]
  return tokens
}

const fixo = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
// O site usa um tema único, fixo (decisão do Rafael em 21/09/2026, paleta revisada pelo Lucas em 24/09/2026 — tarefa 2.18).
const TEMAS = { fixo: lerTokens(fixo) }

const luminancia = (hex: string) => {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// [primeiro plano, fundo, mínimo, onde é usado]
const PARES: [string, string, number, string][] = [
  ['texto', 'bg', 4.5, 'texto normal'],
  ['texto', 'superficie', 4.5, 'texto em cartões e campos'],
  ['texto', 'acento-suave', 4.5, 'texto em avisos'],
  ['muted', 'bg', 4.5, 'texto secundário'],
  ['muted', 'superficie', 4.5, 'texto secundário em cartões'],
  ['muted', 'acento-suave', 4.5, 'texto secundário em avisos'],
  ['acento', 'bg', 4.5, 'links'],
  ['acento', 'superficie', 4.5, 'links em cartões'],
  ['acento', 'acento-suave', 4.5, 'selo "Combo" e links em avisos'],
  ['sobre-acento', 'acento', 4.5, 'texto do botão principal'],
  ['ok-texto', 'ok-fundo', 4.5, 'aberto agora e selo de desconto'],
  ['fechado-texto', 'fechado-fundo', 4.5, 'fechado, esgotado e mensagens de erro'],
  ['foco', 'bg', 3, 'anel de foco (componente de interface)'],
  ['foco', 'superficie', 3, 'anel de foco em cartões'],
  ['borda-campo', 'bg', 3, 'borda dos campos de formulário'],
  ['borda-campo', 'superficie', 3, 'borda dos campos dentro de cartões'],
]

describe('contraste de cor (WCAG 2.1 AA)', () => {
  it('lê os tokens do tema fixo', () => {
    expect(Object.keys(TEMAS.fixo).length).toBeGreaterThan(10)
  })

  it('o tema é fixo: nenhum CSS troca de cor pelo modo claro/escuro do aparelho', () => {
    const outros = ['cardapio.css', 'legal.css', 'admin.css', 'cozinha.css', 'index.css']
    for (const arquivo of outros) {
      const texto = readFileSync(resolve(process.cwd(), 'src', arquivo), 'utf8')
      expect(texto, arquivo).not.toMatch(/prefers-color-scheme:\s*(dark|light)/)
    }
    expect(readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')).toMatch(
      /color-scheme:\s*dark;/,
    )
  })

  for (const [tema, tokens] of Object.entries(TEMAS)) {
    it.each(PARES)(`tema ${tema}: %s sobre %s ≥ %d:1 (%s)`, (fg, bg, minimo, uso) => {
      expect(tokens[fg], `token --${fg} ausente no tema ${tema}`).toBeDefined()
      expect(tokens[bg], `token --${bg} ausente no tema ${tema}`).toBeDefined()
      const razao = contraste(tokens[fg], tokens[bg])
      expect(
        razao,
        `${uso}: ${fg} ${tokens[fg]} sobre ${bg} ${tokens[bg]} = ${razao.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(minimo)
    })
  }

  it('o realce amarelo das pendências do texto legal (fixo no CSS) também passa', () => {
    expect(contraste('#451a03', '#fde68a')).toBeGreaterThanOrEqual(4.5)
  })
})
