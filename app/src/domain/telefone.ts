/**
 * Normaliza telefone brasileiro para só dígitos com DDD (10 ou 11 dígitos), que é o formato
 * salvo no banco. Aceita "(71) 99999-9999", "+55 71 99999-9999", "5571999999999"...
 * Devolve null se não for um número válido (DDD 11–99; celular de 11 dígitos começa com 9).
 */
export function normalizarTelefone(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, '')
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2)
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null
  const ddd = Number(digitos.slice(0, 2))
  if (ddd < 11 || ddd > 99) return null
  if (digitos.length === 11 && digitos[2] !== '9') return null
  return digitos
}
