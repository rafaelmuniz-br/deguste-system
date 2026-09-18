// Converte os bytes da impressora de volta em texto legível, para os testes conferirem o recibo.
// Remove os comandos ESC/POS (ESC @, ESC t/a/E/d n, GS ! n, GS V B n) e devolve o texto em latin1.
export function textoDoRecibo(bytes) {
  const saida = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b === 0x1b) {
      i += bytes[i + 1] === 0x40 ? 1 : 2 // ESC @ (2 bytes) ou ESC x n (3 bytes)
    } else if (b === 0x1d) {
      i += bytes[i + 1] === 0x56 ? 3 : 2 // GS V B n (4 bytes) ou GS ! n (3 bytes)
    } else saida.push(b)
  }
  return Buffer.from(saida).toString('latin1')
}
