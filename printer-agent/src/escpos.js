// Construtor mínimo de comandos ESC/POS, o "idioma" das impressoras térmicas de cupom.
// Só o que o recibo usa: alinhar, negrito, tamanho, avançar papel e cortar.

// Acentos do português na página de código CP860 (a "PC860 Portuguese" das impressoras Epson e
// compatíveis). Caractere fora da tabela vira "?" em vez de lixo na impressão.
const CP860 = new Map(
  Object.entries({
    'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ã': 0x84, 'à': 0x85, 'Á': 0x86, 'ç': 0x87, 'ê': 0x88, 'Ê': 0x89,
    'è': 0x8a, 'Í': 0x8b, 'Ô': 0x8c, 'ì': 0x8d, 'Ã': 0x8e, 'Â': 0x8f, 'É': 0x90, 'À': 0x91, 'È': 0x92, 'ô': 0x93,
    'õ': 0x94, 'ò': 0x95, 'Ú': 0x96, 'ù': 0x97, 'Ì': 0x98, 'Õ': 0x99, 'Ü': 0x9a, 'Ù': 0x9d, 'Ó': 0x9f, 'á': 0xa0,
    'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, 'Ò': 0xa9, '½': 0xab,
    '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
  }),
)

/** Tira acentos (para impressoras que imprimem lixo com acento). "Ação" vira "Acao". */
export function semAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Texto -> bytes da impressora.
 * modo "cp860": acentos do português (a impressora precisa estar na página PC860).
 * modo "ascii": sem acentos, funciona em qualquer impressora.
 */
export function codificar(texto, modo = 'cp860') {
  const origem = modo === 'ascii' ? semAcentos(texto) : texto
  const bytes = []
  for (const ch of origem) {
    const codigo = ch.codePointAt(0)
    if (ch === '\n') bytes.push(0x0a)
    else if (codigo >= 0x20 && codigo < 0x7f) bytes.push(codigo)
    else if (modo === 'cp860' && CP860.has(ch)) bytes.push(CP860.get(ch))
    else if (ch === '\t') bytes.push(0x20)
    else bytes.push(0x3f) // "?"
  }
  return Buffer.from(bytes)
}

export function criarEscPos({ acentos = 'cp860', paginaDeCodigo = 3 } = {}) {
  const partes = []
  const cmd = (...bytes) => partes.push(Buffer.from(bytes))

  const api = {
    /** Zera a impressora e escolhe a página de código dos acentos. */
    iniciar() {
      cmd(0x1b, 0x40)
      if (acentos === 'cp860') cmd(0x1b, 0x74, paginaDeCodigo)
      return api
    },
    alinhar(lado) {
      cmd(0x1b, 0x61, { esquerda: 0, centro: 1, direita: 2 }[lado] ?? 0)
      return api
    },
    negrito(ligado) {
      cmd(0x1b, 0x45, ligado ? 1 : 0)
      return api
    },
    /** Tamanho da letra: 1 = normal, 2 = dobro (largura e altura), até 4. */
    tamanho(multiplicador) {
      const n = Math.min(4, Math.max(1, multiplicador)) - 1
      cmd(0x1d, 0x21, (n << 4) | n)
      return api
    },
    texto(t) {
      partes.push(codificar(t, acentos))
      return api
    },
    linha(t = '') {
      return api.texto(`${t}\n`)
    },
    avancar(linhas) {
      cmd(0x1b, 0x64, Math.min(255, Math.max(0, linhas)))
      return api
    },
    /** Corte parcial, depois de avançar um pouco o papel. */
    cortar() {
      cmd(0x1d, 0x56, 0x42, 0x03)
      return api
    },
    bytes() {
      return Buffer.concat(partes)
    },
  }
  return api
}
