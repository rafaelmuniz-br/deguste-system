/**
 * Limitador simples de requisições por chave (ex.: IP), em janela deslizante, na memória.
 *
 * ATENÇÃO: funções serverless são instâncias efêmeras e independentes; este limite vale POR
 * INSTÂNCIA quente, então é uma barreira barata contra abuso casual, não uma garantia. A proteção
 * que vale para todos os casos fica no banco (limite de pedidos pendentes por telefone).
 */
export function criarLimitador({
  max,
  janelaMs,
  agora = () => Date.now(),
}: {
  max: number
  janelaMs: number
  agora?: () => number
}): (chave: string) => boolean {
  const registros = new Map<string, number[]>()
  const LIMITE_DE_CHAVES = 5000

  return (chave) => {
    const t = agora()
    const recentes = (registros.get(chave) ?? []).filter((momento) => t - momento < janelaMs)
    if (recentes.length >= max) {
      registros.set(chave, recentes)
      return false
    }
    recentes.push(t)
    registros.set(chave, recentes)

    // Não deixa o mapa crescer sem fim: descarta chaves cujos registros já expiraram.
    if (registros.size > LIMITE_DE_CHAVES) {
      for (const [k, momentos] of registros) {
        if (momentos.every((momento) => t - momento >= janelaMs)) registros.delete(k)
      }
    }
    return true
  }
}
