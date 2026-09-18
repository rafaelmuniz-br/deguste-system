// Tipos de domínio do cardápio. Espelham as tabelas do banco (supabase/migrations),
// em camelCase. Dinheiro sempre em CENTAVOS (inteiros).

export type Categoria = {
  id: string
  nome: string
  descricao?: string
  ordem: number
}

export type Opcao = {
  id: string
  nome: string
  precoAdicionalCentavos: number
  /** Se preenchido, escolher a opção vende esse produto REAL (ex.: hambúrguer dentro do combo). */
  produtoId?: string
  disponivel: boolean
}

export type GrupoOpcao = {
  id: string
  nome: string
  minEscolhas: number
  maxEscolhas: number
  opcoes: Opcao[]
}

export type Produto = {
  id: string
  categoriaId: string
  nome: string
  descricao?: string
  precoCentavos: number
  fotoUrl?: string
  ehCombo: boolean
  /** false = esgotado (aparece bloqueado, não some). */
  disponivel: boolean
  grupos: GrupoOpcao[]
}

export type HorarioFuncionamento = {
  /** 0 = domingo ... 6 = sábado */
  diaSemana: number
  /** "HH:MM" ou "HH:MM:SS" */
  abre: string
  fecha: string
}

export type ModoFuncionamento = 'automatico' | 'forcar_aberta' | 'forcar_fechada'

export type ConfigLoja = {
  nome: string
  fusoHorario: string
  modo: ModoFuncionamento
  pedidoMinimoCentavos: number
  tempoPreparoMin: number
  horarios: HorarioFuncionamento[]
}

export type Cardapio = {
  categorias: Categoria[]
  produtos: Produto[]
  loja: ConfigLoja
}
