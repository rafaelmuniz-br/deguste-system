// Relatórios de vendas (tarefa 6.2): tipos, períodos e formatação. Os números vêm prontos do banco
// (função relatorio_vendas); aqui só convertemos e escolhemos o período, sempre no fuso da Bahia.

export type ResumoVendas = {
  pedidos: number
  receitaCentavos: number
  ticketMedioCentavos: number
  cancelados: number
}

export type RelatorioVendas = {
  inicio: string
  fim: string
  resumo: ResumoVendas
  porDia: { dia: string; pedidos: number; receitaCentavos: number }[]
  porCanal: { canal: string; pedidos: number; receitaCentavos: number }[]
  porTipo: { tipo: string; pedidos: number; receitaCentavos: number }[]
  porHora: { hora: number; pedidos: number }[]
  produtos: {
    produtoId: string
    nome: string
    unidades: number
    unidadesEmCombo: number
    receitaAvulsaCentavos: number
  }[]
}

/** JSON da função do banco (snake_case; contagens podem vir como número ou texto). */
export type RelatorioBruto = {
  periodo: { inicio: string; fim: string }
  resumo: {
    pedidos: number | string
    receita_centavos: number | string
    ticket_medio_centavos: number | string
    cancelados: number | string
  }
  por_dia: { dia: string; pedidos: number | string; receita_centavos: number | string }[]
  por_canal: { canal: string; pedidos: number | string; receita_centavos: number | string }[]
  por_tipo: { tipo: string; pedidos: number | string; receita_centavos: number | string }[]
  por_hora: { hora: number | string; pedidos: number | string }[]
  produtos: {
    produto_id: string
    nome: string
    unidades: number | string
    unidades_em_combo: number | string
    receita_avulsa_centavos: number | string
  }[]
}

export function mapearRelatorio(b: RelatorioBruto): RelatorioVendas {
  const n = Number
  return {
    inicio: b.periodo.inicio,
    fim: b.periodo.fim,
    resumo: {
      pedidos: n(b.resumo.pedidos),
      receitaCentavos: n(b.resumo.receita_centavos),
      ticketMedioCentavos: n(b.resumo.ticket_medio_centavos),
      cancelados: n(b.resumo.cancelados),
    },
    porDia: b.por_dia.map((d) => ({
      dia: d.dia,
      pedidos: n(d.pedidos),
      receitaCentavos: n(d.receita_centavos),
    })),
    porCanal: b.por_canal.map((c) => ({
      canal: c.canal,
      pedidos: n(c.pedidos),
      receitaCentavos: n(c.receita_centavos),
    })),
    porTipo: b.por_tipo.map((t) => ({
      tipo: t.tipo,
      pedidos: n(t.pedidos),
      receitaCentavos: n(t.receita_centavos),
    })),
    porHora: b.por_hora.map((h) => ({ hora: n(h.hora), pedidos: n(h.pedidos) })),
    produtos: b.produtos.map((p) => ({
      produtoId: p.produto_id,
      nome: p.nome,
      unidades: n(p.unidades),
      unidadesEmCombo: n(p.unidades_em_combo),
      receitaAvulsaCentavos: n(p.receita_avulsa_centavos),
    })),
  }
}

// ---------- períodos ----------

export type PeriodoId = 'hoje' | 'ontem' | '7dias' | '30dias' | 'mes'

export const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7dias', rotulo: 'Últimos 7 dias' },
  { id: '30dias', rotulo: 'Últimos 30 dias' },
  { id: 'mes', rotulo: 'Este mês' },
]

/** Data de hoje (AAAA-MM-DD) no fuso da Bahia, não no do aparelho. */
export function hojeNaBahia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bahia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

/** Soma dias a uma data AAAA-MM-DD (aritmética em UTC: sem surpresa de horário de verão). */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export function periodoPredefinido(
  id: PeriodoId,
  agora: Date = new Date(),
): { inicio: string; fim: string } {
  const hoje = hojeNaBahia(agora)
  switch (id) {
    case 'hoje':
      return { inicio: hoje, fim: hoje }
    case 'ontem':
      return { inicio: somarDias(hoje, -1), fim: somarDias(hoje, -1) }
    case '7dias':
      return { inicio: somarDias(hoje, -6), fim: hoje }
    case '30dias':
      return { inicio: somarDias(hoje, -29), fim: hoje }
    case 'mes':
      return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje }
  }
}

/** Valida um período digitado. Devolve a mensagem de erro ou null. */
export function validarPeriodo(inicio: string, fim: string): string | null {
  const ok = /^\d{4}-\d{2}-\d{2}$/
  if (!ok.test(inicio) || !ok.test(fim)) return 'Informe as duas datas.'
  if (fim < inicio) return 'A data final não pode ser antes da inicial.'
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000
  if (dias > 366) return 'O período máximo é de 1 ano.'
  return null
}

// ---------- apresentação ----------

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-09-10" → "qui 10/09". */
export function rotuloDoDia(data: string): string {
  const [a, m, d] = data.split('-').map(Number)
  const dia = DIAS_CURTOS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

export const rotuloCanal = (canal: string) =>
  ({ proprio: 'Site próprio', ifood: 'iFood', '99food': '99Food' })[canal] ?? canal

export const rotuloTipo = (tipo: string) =>
  ({ entrega: 'Entrega', retirada: 'Retirada' })[tipo] ?? tipo

export const rotuloHora = (hora: number) => `${String(hora).padStart(2, '0')}h`

/** Largura da barra (0 a 100) em relação ao maior valor da lista. */
export function percentualDaBarra(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) return 0
  return Math.max(2, Math.round((valor / maximo) * 100)) // mínimo visível
}

// ---------- exportação (CSV) ----------

/** "2026-09-10T22:30:00Z" → "10/09/2026 19:30" (hora de Salvador). */
export function dataHoraDaBahia(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? ''
  return `${p('day')}/${p('month')}/${p('year')} ${p('hour')}:${p('minute')}`
}
