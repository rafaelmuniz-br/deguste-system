const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 2199 -> "R$ 21,99". Só para exibição: cálculos são sempre em centavos. */
export function formatarPreco(centavos: number): string {
  return brl.format(centavos / 100)
}
