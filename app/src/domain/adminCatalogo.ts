// Regras do cadastro de categorias e produtos (tarefas 1.8 e 1.9). Puras e testadas; as telas só as usam.
// Dinheiro é sempre CENTAVOS (inteiro): quem digita preço digita em reais, e a conversão fica aqui.

/**
 * "12", "12,5", "12,50", "12.50", "R$ 12,50", "1.234,56" → centavos. Vazio ou inválido → null.
 * Recusa mais de 2 casas decimais e valores negativos (melhor errar alto do que gravar preço errado).
 */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (limpo === '') return null
  // Formato brasileiro "1.234,56" (ponto = milhar, vírgula = decimal) ou simples "12.50" / "12,50".
  const bruto = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpo)
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return null
  const [reais, decimais = ''] = bruto.split('.')
  const centavos = Number(reais) * 100 + Number(decimais.padEnd(2, '0'))
  return Number.isSafeInteger(centavos) && centavos <= 100_000_00 ? centavos : null
}

/** 1250 → "12,50" (para preencher o campo de edição). */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

export type CategoriaAdmin = {
  id: string
  nome: string
  descricao: string
  ordem: number
  ativo: boolean
}

export type ProdutoAdmin = {
  id: string
  categoriaId: string
  nome: string
  descricao: string
  precoCentavos: number
  precoOriginalCentavos: number | null
  fotoPath: string | null
  ehCombo: boolean
  disponivel: boolean
  ativo: boolean
  ordem: number
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erros: string[] }

export type FormCategoria = { nome: string; descricao: string; ativo: boolean }

export type CategoriaParaSalvar = { nome: string; descricao: string | null; ativo: boolean }

export function validarCategoria(f: FormCategoria): Validacao<CategoriaParaSalvar> {
  const erros: string[] = []
  const nome = f.nome.trim()
  if (nome.length < 2) erros.push('Informe o nome da categoria (mínimo 2 letras).')
  if (nome.length > 60) erros.push('O nome da categoria pode ter no máximo 60 letras.')
  if (erros.length > 0) return { ok: false, erros }
  return { ok: true, valor: { nome, descricao: f.descricao.trim() || null, ativo: f.ativo } }
}

export type FormProduto = {
  categoriaId: string
  nome: string
  descricao: string
  preco: string
  precoOriginal: string
  ehCombo: boolean
  ativo: boolean
}

export type ProdutoParaSalvar = {
  categoriaId: string
  nome: string
  descricao: string | null
  precoCentavos: number
  precoOriginalCentavos: number | null
  ehCombo: boolean
  ativo: boolean
}

export function validarProduto(f: FormProduto): Validacao<ProdutoParaSalvar> {
  const erros: string[] = []
  const nome = f.nome.trim()
  if (!f.categoriaId) erros.push('Escolha a categoria do produto.')
  if (nome.length < 2) erros.push('Informe o nome do produto (mínimo 2 letras).')
  if (nome.length > 80) erros.push('O nome do produto pode ter no máximo 80 letras.')
  if (f.descricao.trim().length > 300) erros.push('A descrição pode ter no máximo 300 letras.')

  const preco = reaisParaCentavos(f.preco)
  if (preco === null) erros.push('Informe o preço em reais, por exemplo 21,90.')

  let precoOriginal: number | null = null
  if (f.precoOriginal.trim() !== '') {
    precoOriginal = reaisParaCentavos(f.precoOriginal)
    if (precoOriginal === null) {
      erros.push('O preço "de" está inválido. Use reais, por exemplo 25,90, ou deixe em branco.')
    } else if (preco !== null && precoOriginal <= preco) {
      erros.push('O preço "de" precisa ser maior que o preço atual (é o preço riscado).')
    }
  }

  if (erros.length > 0 || preco === null) return { ok: false, erros }
  return {
    ok: true,
    valor: {
      categoriaId: f.categoriaId,
      nome,
      descricao: f.descricao.trim() || null,
      precoCentavos: preco,
      precoOriginalCentavos: precoOriginal,
      ehCombo: f.ehCombo,
      ativo: f.ativo,
    },
  }
}

/**
 * Move o item `id` uma posição para cima (-1) ou para baixo (+1) e devolve os ids na nova ordem.
 * Devolve null se já está na ponta (nada a fazer).
 */
export function moverNaLista(ids: string[], id: string, direcao: -1 | 1): string[] | null {
  const i = ids.indexOf(id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= ids.length) return null
  const novo = [...ids]
  ;[novo[i], novo[j]] = [novo[j], novo[i]]
  return novo
}
