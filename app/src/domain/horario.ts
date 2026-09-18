import type { ConfigLoja, HorarioFuncionamento } from './tipos.ts'

export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export type EstadoLoja = {
  aberta: boolean
  /** Por que está nesse estado. */
  motivo: 'forcada' | 'horario'
  /** Quando aberta: horário em que fecha hoje ("22:00"). */
  fechaAs?: string
  /** Quando fechada: próxima abertura. `diasAte` = 0 significa hoje. */
  proximaAbertura?: { diasAte: number; diaSemana: number; abre: string }
}

const MAPA_DIA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Dia da semana e minutos desde 00:00 no fuso da loja (não no fuso do aparelho do cliente). */
function agoraNoFuso(agora: Date, fuso: string): { dia: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora)
  const pega = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return {
    dia: MAPA_DIA[pega('weekday')] ?? 0,
    minutos: Number(pega('hour')) * 60 + Number(pega('minute')),
  }
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export function formatarHora(hhmm: string): string {
  return hhmm.slice(0, 5)
}

/**
 * Loja aberta ou fechada neste instante, considerando o fuso da loja (America/Bahia)
 * e o modo manual (forçar aberta/fechada) configurado no admin.
 */
export function estadoLoja(loja: ConfigLoja, agora: Date = new Date()): EstadoLoja {
  if (loja.modo === 'forcar_aberta') return { aberta: true, motivo: 'forcada' }
  if (loja.modo === 'forcar_fechada') return { aberta: false, motivo: 'forcada' }

  const { dia, minutos } = agoraNoFuso(agora, loja.fusoHorario)

  const abertoAgora = loja.horarios.find(
    (h) => h.diaSemana === dia && paraMinutos(h.abre) <= minutos && minutos < paraMinutos(h.fecha),
  )
  if (abertoAgora) {
    return { aberta: true, motivo: 'horario', fechaAs: formatarHora(abertoAgora.fecha) }
  }

  return {
    aberta: false,
    motivo: 'horario',
    proximaAbertura: proximaAbertura(loja.horarios, dia, minutos),
  }
}

function proximaAbertura(horarios: HorarioFuncionamento[], dia: number, minutos: number) {
  for (let diasAte = 0; diasAte <= 7; diasAte++) {
    const diaAlvo = (dia + diasAte) % 7
    const candidatos = horarios
      .filter((h) => h.diaSemana === diaAlvo && (diasAte > 0 || paraMinutos(h.abre) > minutos))
      .sort((a, b) => paraMinutos(a.abre) - paraMinutos(b.abre))
    if (candidatos.length > 0) {
      return { diasAte, diaSemana: diaAlvo, abre: formatarHora(candidatos[0].abre) }
    }
  }
  return undefined
}

/** Texto curto para o cliente. */
export function descreverEstado(estado: EstadoLoja): string {
  if (estado.aberta) {
    return estado.fechaAs ? `Aberto agora · fechamos às ${estado.fechaAs}` : 'Aberto agora'
  }
  const p = estado.proximaAbertura
  if (!p) return 'Fechado no momento'
  if (p.diasAte === 0) return `Fechado · abrimos hoje às ${p.abre}`
  if (p.diasAte === 1) return `Fechado · abrimos amanhã às ${p.abre}`
  return `Fechado · abrimos ${DIAS_SEMANA[p.diaSemana]} às ${p.abre}`
}
