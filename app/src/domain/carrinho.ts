import type { Cardapio, GrupoOpcao, Produto } from './tipos.ts'

/** grupoId -> ids das opções escolhidas */
export type Escolhas = Record<string, string[]>

export type LinhaCarrinho = {
  id: string
  produtoId: string
  quantidade: number
  escolhas: Escolhas
  observacao: string
}

export type LinhaResolvida = LinhaCarrinho & {
  produto: Produto
  /** "Ponto: Mal passado · Bacon extra" */
  resumoEscolhas: string[]
  precoUnitarioCentavos: number
  totalCentavos: number
}

/**
 * ATENÇÃO: estes valores são só para EXIBIR a sacola. O servidor (Fase 3, função
 * `criar-pedido`) sempre recalcula preço e frete a partir do banco.
 */
export function precoUnitario(produto: Produto, escolhas: Escolhas): number {
  let total = produto.precoCentavos
  for (const grupo of produto.grupos) {
    for (const opcaoId of escolhas[grupo.id] ?? []) {
      total += grupo.opcoes.find((o) => o.id === opcaoId)?.precoAdicionalCentavos ?? 0
    }
  }
  return total
}

export function mensagemGrupo(grupo: GrupoOpcao): string {
  const { minEscolhas: min, maxEscolhas: max } = grupo
  if (min === max) return min === 1 ? 'Escolha 1' : `Escolha ${min}`
  if (min === 0) return max === 1 ? 'Opcional' : `Opcional · até ${max}`
  return `Escolha de ${min} a ${max}`
}

/** Lista de problemas que impedem adicionar o produto (vazia = válido). */
export function validarEscolhas(produto: Produto, escolhas: Escolhas): string[] {
  const erros: string[] = []
  for (const grupo of produto.grupos) {
    const escolhidas = (escolhas[grupo.id] ?? []).filter((id) =>
      grupo.opcoes.some((o) => o.id === id && o.disponivel),
    )
    if (escolhidas.length < grupo.minEscolhas) {
      erros.push(
        `Escolha ${grupo.minEscolhas === 1 ? 'uma opção' : `pelo menos ${grupo.minEscolhas}`} em "${grupo.nome}"`,
      )
    }
    if (escolhidas.length > grupo.maxEscolhas) {
      erros.push(`"${grupo.nome}" aceita no máximo ${grupo.maxEscolhas}`)
    }
  }
  return erros
}

export function resolverLinha(cardapio: Cardapio, linha: LinhaCarrinho): LinhaResolvida | null {
  const produto = cardapio.produtos.find((p) => p.id === linha.produtoId)
  if (!produto) return null // produto saiu do cardápio desde que foi para a sacola
  const resumoEscolhas: string[] = []
  for (const grupo of produto.grupos) {
    const ids = linha.escolhas[grupo.id] ?? []
    const contagem = new Map<string, number>()
    for (const id of ids) contagem.set(id, (contagem.get(id) ?? 0) + 1)
    const nomes: string[] = []
    for (const [id, vezes] of contagem) {
      const nome = grupo.opcoes.find((o) => o.id === id)?.nome
      if (nome) nomes.push(vezes > 1 ? `${vezes}x ${nome}` : nome)
    }
    if (nomes.length > 0) resumoEscolhas.push(`${grupo.nome}: ${nomes.join(', ')}`)
  }
  const unitario = precoUnitario(produto, linha.escolhas)
  return {
    ...linha,
    produto,
    resumoEscolhas,
    precoUnitarioCentavos: unitario,
    totalCentavos: unitario * linha.quantidade,
  }
}

export function resolverCarrinho(cardapio: Cardapio, linhas: LinhaCarrinho[]): LinhaResolvida[] {
  return linhas.flatMap((l) => resolverLinha(cardapio, l) ?? [])
}

export function subtotal(linhas: LinhaResolvida[]): number {
  return linhas.reduce((soma, l) => soma + l.totalCentavos, 0)
}

export const QUANTIDADE_MAXIMA = 20

export type Acao =
  | { tipo: 'adicionar'; linha: LinhaCarrinho }
  | { tipo: 'quantidade'; id: string; quantidade: number }
  | { tipo: 'remover'; id: string }
  | { tipo: 'limpar' }

function mesmasEscolhas(a: Escolhas, b: Escolhas): boolean {
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of chaves) {
    const x = [...(a[k] ?? [])].sort().join(',')
    const y = [...(b[k] ?? [])].sort().join(',')
    if (x !== y) return false
  }
  return true
}

export function carrinhoReducer(estado: LinhaCarrinho[], acao: Acao): LinhaCarrinho[] {
  switch (acao.tipo) {
    case 'adicionar': {
      // Mesmo produto + mesmas escolhas + mesma observação = soma na linha existente.
      const igual = estado.find(
        (l) =>
          l.produtoId === acao.linha.produtoId &&
          l.observacao === acao.linha.observacao &&
          mesmasEscolhas(l.escolhas, acao.linha.escolhas),
      )
      if (igual) {
        return estado.map((l) =>
          l.id === igual.id
            ? {
                ...l,
                quantidade: Math.min(QUANTIDADE_MAXIMA, l.quantidade + acao.linha.quantidade),
              }
            : l,
        )
      }
      return [
        ...estado,
        { ...acao.linha, quantidade: Math.min(QUANTIDADE_MAXIMA, acao.linha.quantidade) },
      ]
    }
    case 'quantidade':
      if (acao.quantidade <= 0) return estado.filter((l) => l.id !== acao.id)
      return estado.map((l) =>
        l.id === acao.id ? { ...l, quantidade: Math.min(QUANTIDADE_MAXIMA, acao.quantidade) } : l,
      )
    case 'remover':
      return estado.filter((l) => l.id !== acao.id)
    case 'limpar':
      return []
  }
}

// ---- Persistência no navegador (por dispositivo; nunca é a fonte de verdade de preços) ----

const CHAVE = 'deguste:sacola:v1'

export function carregarSacola(): LinhaCarrinho[] {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return []
    const dados: unknown = JSON.parse(bruto)
    if (!Array.isArray(dados)) return []
    return dados.filter(
      (l): l is LinhaCarrinho =>
        typeof l === 'object' &&
        l !== null &&
        typeof l.id === 'string' &&
        typeof l.produtoId === 'string' &&
        Number.isInteger(l.quantidade) &&
        l.quantidade > 0 &&
        typeof l.escolhas === 'object' &&
        l.escolhas !== null &&
        typeof l.observacao === 'string',
    )
  } catch {
    return []
  }
}

export function salvarSacola(linhas: LinhaCarrinho[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(linhas))
  } catch {
    // navegador em modo privado/sem armazenamento: a sacola só não sobrevive ao recarregar
  }
}
