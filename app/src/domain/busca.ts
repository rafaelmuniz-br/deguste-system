const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Busca sem diferenciar acentos/maiúsculas: "cafe" acha "Café", "bolado" acha "Boladão". */
export function combinaComBusca(termo: string, ...campos: (string | undefined)[]): boolean {
  const alvo = normalizar(termo)
  if (!alvo) return true
  return campos.some((c) => c && normalizar(c).includes(alvo))
}
