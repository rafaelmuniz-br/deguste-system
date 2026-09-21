import qrcode from 'qrcode-generator'

// QR Code do Pix, desenhado no próprio navegador a partir do "copia e cola" (nenhum serviço externo:
// o código do pagamento não sai do aparelho do cliente). Devolvemos os quadradinhos como dados e
// desenhamos em SVG no componente, sem `innerHTML`.

export type MatrizQr = boolean[][]

/** Gera a matriz de módulos (true = quadrado escuro). Nível de correção "M" (15%), o padrão do Pix. */
export function gerarMatrizQr(texto: string): MatrizQr {
  const qr = qrcode(0, 'M') // tipo 0 = escolhe o menor tamanho que cabe o texto
  qr.addData(texto)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, linha) =>
    Array.from({ length: n }, (_, coluna) => qr.isDark(linha, coluna)),
  )
}

/**
 * Converte a matriz no atributo `d` de UM `<path>`: cada quadrado escuro vira "M x y h1 v1 h-1 z".
 * Um path só (em vez de milhares de `<rect>`) mantém a página leve.
 */
export function caminhoDoQr(matriz: MatrizQr): string {
  const partes: string[] = []
  matriz.forEach((linha, y) => {
    linha.forEach((escuro, x) => {
      if (escuro) partes.push(`M${x} ${y}h1v1h-1z`)
    })
  })
  return partes.join('')
}

/** Margem branca ao redor exigida pela norma do QR (4 módulos): sem ela, alguns leitores não acham o código. */
export const MARGEM_QR = 4
