import { centavosParaReais, reaisParaCentavos, type Validacao } from './adminCatalogo.ts'
import type { ModoFuncionamento } from './tipos.ts'

// Regras das configurações da loja (tarefa 1.12): horários, modo aberta/fechada, frete, mínimo, tempo de preparo.
// Puras e testadas; a tela só as usa. Dinheiro em centavos, como no resto do sistema.

export type Intervalo = {
  /** 0 = domingo ... 6 = sábado */
  dia: number
  /** "HH:MM" */
  abre: string
  fecha: string
}

/** Como a configuração é gravada no banco (e lida de lá). */
export type DadosLoja = {
  nome: string
  modo: ModoFuncionamento
  endereco: string | null
  latitude: number | null
  longitude: number | null
  freteBaseCentavos: number
  fretePorKmCentavos: number
  raioMaximoKm: number
  pedidoMinimoCentavos: number
  tempoPreparoMin: number
  horarios: Intervalo[]
}

/** Como a configuração é digitada na tela: tudo texto, para a pessoa poder digitar meio-termo sem a tela brigar. */
export type FormLoja = {
  nome: string
  modo: ModoFuncionamento
  endereco: string
  latitude: string
  longitude: string
  freteBase: string
  fretePorKm: string
  raioKm: string
  pedidoMinimo: string
  tempoPreparo: string
  horarios: Intervalo[]
}

export const NOMES_DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

/** Ordem de exibição: a semana começa na segunda (o domingo é o último dia, como no comércio). */
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

const numeroDecimal = (texto: string): number | null => {
  const limpo = texto.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null
  return Number(limpo)
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const paraMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export function dadosParaForm(d: DadosLoja): FormLoja {
  return {
    nome: d.nome,
    modo: d.modo,
    endereco: d.endereco ?? '',
    latitude: d.latitude === null ? '' : String(d.latitude).replace('.', ','),
    longitude: d.longitude === null ? '' : String(d.longitude).replace('.', ','),
    freteBase: centavosParaReais(d.freteBaseCentavos),
    fretePorKm: centavosParaReais(d.fretePorKmCentavos),
    raioKm: String(d.raioMaximoKm).replace('.', ','),
    pedidoMinimo: centavosParaReais(d.pedidoMinimoCentavos),
    tempoPreparo: String(d.tempoPreparoMin),
    horarios: d.horarios.map((h) => ({
      ...h,
      abre: h.abre.slice(0, 5),
      fecha: h.fecha.slice(0, 5),
    })),
  }
}

/** Dinheiro em branco vale zero (ex.: "sem pedido mínimo", "frete grátis"). */
function dinheiro(texto: string, nome: string, erros: string[]): number {
  if (texto.trim() === '') return 0
  const c = reaisParaCentavos(texto)
  if (c === null) {
    erros.push(`${nome}: use reais, por exemplo 5,00 (ou deixe em branco para zero).`)
    return 0
  }
  return c
}

export function validarLoja(f: FormLoja): Validacao<DadosLoja> {
  const erros: string[] = []

  const nome = f.nome.trim()
  if (nome.length < 2) erros.push('Informe o nome da loja.')

  const freteBase = dinheiro(f.freteBase, 'Taxa de entrega base', erros)
  const fretePorKm = dinheiro(f.fretePorKm, 'Valor por km', erros)
  const pedidoMinimo = dinheiro(f.pedidoMinimo, 'Pedido mínimo', erros)

  const raio = numeroDecimal(f.raioKm)
  if (raio === null || raio <= 0 || raio > 50) {
    erros.push('Raio de entrega: informe um número de km entre 0,5 e 50.')
  }

  const tempoTxt = f.tempoPreparo.trim()
  const tempo = /^\d+$/.test(tempoTxt) ? Number(tempoTxt) : NaN
  if (!Number.isInteger(tempo) || tempo < 5 || tempo > 240) {
    erros.push('Tempo de preparo: informe os minutos, entre 5 e 240.')
  }

  // Coordenadas: as duas ou nenhuma (sem elas o frete por distância não tem de onde medir).
  const lat = f.latitude.trim() === '' ? null : numeroDecimal(f.latitude)
  const lon = f.longitude.trim() === '' ? null : numeroDecimal(f.longitude)
  const temLat = f.latitude.trim() !== ''
  const temLon = f.longitude.trim() !== ''
  if (temLat !== temLon) {
    erros.push('Preencha latitude e longitude juntas, ou deixe as duas em branco.')
  } else {
    if (temLat && (lat === null || lat < -90 || lat > 90)) {
      erros.push('Latitude inválida (exemplo: -12,9714).')
    }
    if (temLon && (lon === null || lon < -180 || lon > 180)) {
      erros.push('Longitude inválida (exemplo: -38,5014).')
    }
  }

  // Horários: formato, fecha depois de abrir e sem sobreposição no mesmo dia.
  const porDia = new Map<number, { abre: number; fecha: number; texto: string }[]>()
  for (const h of f.horarios) {
    const dia = NOMES_DIAS[h.dia]
    if (!HORA.test(h.abre) || !HORA.test(h.fecha)) {
      erros.push(`${dia}: preencha os dois horários (abre e fecha).`)
      continue
    }
    const abre = paraMinutos(h.abre)
    const fecha = paraMinutos(h.fecha)
    if (fecha <= abre) {
      erros.push(
        `${dia}: o horário de fechar (${h.fecha}) precisa ser depois do de abrir (${h.abre}). ` +
          'Para funcionar depois da meia-noite, feche às 23:59 e reabra à 00:00 no dia seguinte.',
      )
      continue
    }
    const lista = porDia.get(h.dia) ?? []
    lista.push({ abre, fecha, texto: `${h.abre}–${h.fecha}` })
    porDia.set(h.dia, lista)
  }
  for (const [dia, lista] of porDia) {
    const ordenada = [...lista].sort((a, b) => a.abre - b.abre)
    for (let i = 1; i < ordenada.length; i++) {
      if (ordenada[i].abre < ordenada[i - 1].fecha) {
        erros.push(
          `${NOMES_DIAS[dia]}: os horários ${ordenada[i - 1].texto} e ${ordenada[i].texto} se sobrepõem.`,
        )
      }
    }
  }

  if (erros.length > 0 || raio === null) return { ok: false, erros }

  return {
    ok: true,
    valor: {
      nome,
      modo: f.modo,
      endereco: f.endereco.trim() || null,
      latitude: lat,
      longitude: lon,
      freteBaseCentavos: freteBase,
      fretePorKmCentavos: fretePorKm,
      raioMaximoKm: raio,
      pedidoMinimoCentavos: pedidoMinimo,
      tempoPreparoMin: tempo,
      horarios: [...f.horarios].sort((a, b) => a.dia - b.dia || a.abre.localeCompare(b.abre)),
    },
  }
}

/** Resumo em uma linha dos horários de um dia: "18:00–22:00, 12:00–15:00" ou "Fechado". */
export function resumoDoDia(horarios: Intervalo[], dia: number): string {
  const doDia = horarios.filter((h) => h.dia === dia).sort((a, b) => a.abre.localeCompare(b.abre))
  return doDia.length === 0 ? 'Fechado' : doDia.map((h) => `${h.abre}–${h.fecha}`).join(', ')
}
