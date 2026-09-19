// Geração de CSV para abrir no Excel/Planilhas em português (separador ";", vírgula decimal, acentos).
// Segurança: planilhas EXECUTAM células que começam com = + - @ (injeção de fórmula). Como o texto vem de
// clientes (observações, nomes de item), qualquer texto que comece assim ganha um apóstrofo na frente.

export type Coluna<T> = { titulo: string; valor: (linha: T) => string | number | null | undefined }

const PERIGOSOS = /^[=+\-@\t\r]/

/** Escapa uma célula: neutraliza fórmulas, dobra aspas e coloca entre aspas quando precisa. */
export function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  let texto = typeof valor === 'number' ? String(valor) : valor
  // Número de verdade (já formatado por nós, ex.: "-12,50") não é fórmula: só texto vindo de gente.
  if (typeof valor === 'string' && PERIGOSOS.test(texto)) texto = `'${texto}`
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** BOM UTF-8 no começo: sem ele o Excel do Windows mostra "Ã§" no lugar de "ç". Linhas terminam em CRLF. */
export function gerarCsv<T>(linhas: T[], colunas: Coluna<T>[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(';'))
  return '﻿' + [cabecalho, ...corpo].join('\r\n') + '\r\n'
}

/** 3579 → "35,79" (dinheiro em reais com vírgula, sem símbolo, para a planilha somar). */
export function centavosParaCsv(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}
