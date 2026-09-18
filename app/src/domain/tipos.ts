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

/**
 * Como o frete é cobrado. A regra definitiva é decisão de negócio (pendência P4 do plano);
 * os três modelos abaixo cobrem o que costuma existir, e a loja escolhe um.
 */
export type RegraFrete =
  /** Taxa base + valor por km. */
  | { tipo: 'por_km'; baseCentavos: number; porKmCentavos: number }
  /** Tabela por distância: "até 2 km = R$ 5", "até 4 km = R$ 8"... */
  | { tipo: 'faixas_km'; faixas: { ateKm: number; taxaCentavos: number }[] }
  /** Taxa por bairro atendido (não precisa de geocodificação). Chaves via `normalizarBairro`. */
  | { tipo: 'por_bairro'; bairros: Record<string, number> }

export type Coordenadas = { latitude: number; longitude: number }

export type ZonaEntrega = {
  regra: RegraFrete
  /** Distância máxima atendida, em km (vale para regras baseadas em distância). */
  raioMaximoKm: number
  /** Onde fica a loja (origem do cálculo de distância). */
  origem?: Coordenadas
}

export type ConfigLoja = {
  nome: string
  fusoHorario: string
  modo: ModoFuncionamento
  pedidoMinimoCentavos: number
  tempoPreparoMin: number
  horarios: HorarioFuncionamento[]
  entrega: ZonaEntrega
}

export type Cardapio = {
  categorias: Categoria[]
  produtos: Produto[]
  loja: ConfigLoja
}
