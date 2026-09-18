import { reaisParaCentavos, type Validacao } from './adminCatalogo.ts'

// Regras do cadastro de grupos de opção e opções (tarefa 1.10): "Ponto da carne", "Adicionais",
// "Escolha seu hambúrguer" do combo. Puras e testadas; a tela só as usa.

export type OpcaoAdmin = {
  id: string
  grupoId: string
  nome: string
  precoAdicionalCentavos: number
  /** Se preenchido, escolher a opção vende esse produto REAL (relatórios corretos entre combos). */
  produtoId: string | null
  disponivel: boolean
  ativo: boolean
  ordem: number
}

export type GrupoAdmin = {
  id: string
  produtoId: string
  nome: string
  minEscolhas: number
  maxEscolhas: number
  ordem: number
  opcoes: OpcaoAdmin[]
}

export type FormGrupo = { nome: string; minEscolhas: string; maxEscolhas: string }
export type GrupoParaSalvar = { nome: string; minEscolhas: number; maxEscolhas: number }

const inteiro = (t: string): number | null => (/^\d{1,3}$/.test(t.trim()) ? Number(t.trim()) : null)

export function validarGrupo(f: FormGrupo): Validacao<GrupoParaSalvar> {
  const erros: string[] = []
  const nome = f.nome.trim()
  if (nome.length < 2) erros.push('Informe o nome do grupo (ex.: "Ponto da carne").')
  if (nome.length > 60) erros.push('O nome do grupo pode ter no máximo 60 letras.')

  const min = inteiro(f.minEscolhas)
  const max = inteiro(f.maxEscolhas)
  if (min === null) erros.push('Mínimo de escolhas: informe um número (0 se for opcional).')
  if (max === null || max < 1) erros.push('Máximo de escolhas: informe um número de 1 em diante.')
  if (min !== null && max !== null && max >= 1 && min > max) {
    erros.push('O mínimo de escolhas não pode ser maior que o máximo.')
  }

  if (erros.length > 0 || min === null || max === null) return { ok: false, erros }
  return { ok: true, valor: { nome, minEscolhas: min, maxEscolhas: max } }
}

export type FormOpcao = { nome: string; precoAdicional: string; produtoId: string }
export type OpcaoParaSalvar = {
  nome: string
  precoAdicionalCentavos: number
  produtoId: string | null
}

export function validarOpcao(f: FormOpcao): Validacao<OpcaoParaSalvar> {
  const erros: string[] = []
  const nome = f.nome.trim()
  if (nome.length < 1) erros.push('Informe o nome da opção.')
  if (nome.length > 80) erros.push('O nome da opção pode ter no máximo 80 letras.')

  // Em branco = sem custo adicional.
  let preco = 0
  if (f.precoAdicional.trim() !== '') {
    const c = reaisParaCentavos(f.precoAdicional)
    if (c === null) erros.push('Valor adicional: use reais, por exemplo 3,50 (ou deixe em branco).')
    else preco = c
  }

  if (erros.length > 0) return { ok: false, erros }
  return {
    ok: true,
    valor: { nome, precoAdicionalCentavos: preco, produtoId: f.produtoId || null },
  }
}

/** "Escolha 1", "Escolha até 3", "Escolha de 1 a 3", "Opcional, até 2" — como o cliente vê a regra. */
export function descreverRegra(min: number, max: number): string {
  if (min === 0) return max === 1 ? 'Opcional (escolha 1)' : `Opcional, até ${max}`
  if (min === max) return min === 1 ? 'Obrigatório: escolha 1' : `Obrigatório: escolha ${min}`
  return `Obrigatório: escolha de ${min} a ${max}`
}
