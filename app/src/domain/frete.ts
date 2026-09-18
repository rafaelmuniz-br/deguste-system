import type { Coordenadas, ZonaEntrega } from './tipos.ts'

/** "  Pituba " e "pituba" viram a mesma chave; ignora acentos e maiúsculas. */
export function normalizarBairro(bairro: string): string {
  return bairro.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const RAIO_TERRA_KM = 6371

/**
 * Distância em linha reta (haversine). Serve de estimativa quando não há serviço de rotas;
 * a distância por ruas é sempre maior, então prefira o serviço de rotas para cobrar frete.
 */
export function distanciaLinhaRetaKm(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h))
}

export type EntradaFrete = {
  /** Distância da loja até o cliente. Obrigatória nas regras `por_km` e `faixas_km`. */
  distanciaKm?: number
  /** Obrigatório na regra `por_bairro`. */
  bairro?: string
}

export type ResultadoFrete =
  | { ok: true; taxaCentavos: number; distanciaKm?: number }
  | { ok: false; motivo: 'FORA_DA_AREA' | 'DISTANCIA_INDISPONIVEL' }

/** Distância com 2 casas (é assim que vai para o banco: numeric(6,2)). */
export const arredondarKm = (km: number) => Math.round(km * 100) / 100

/**
 * Taxa de entrega em centavos. Sempre inteira e nunca negativa.
 * Fora da área de atendimento ou sem dado suficiente: recusa (nunca chuta um preço).
 */
export function calcularFrete(zona: ZonaEntrega, entrada: EntradaFrete): ResultadoFrete {
  const { regra } = zona

  if (regra.tipo === 'por_bairro') {
    if (!entrada.bairro) return { ok: false, motivo: 'FORA_DA_AREA' }
    const taxa = regra.bairros[normalizarBairro(entrada.bairro)]
    return taxa === undefined
      ? { ok: false, motivo: 'FORA_DA_AREA' }
      : { ok: true, taxaCentavos: taxa }
  }

  const km = entrada.distanciaKm
  if (km === undefined || !Number.isFinite(km) || km < 0) {
    return { ok: false, motivo: 'DISTANCIA_INDISPONIVEL' }
  }
  const distanciaKm = arredondarKm(km)
  if (distanciaKm > zona.raioMaximoKm) return { ok: false, motivo: 'FORA_DA_AREA' }

  if (regra.tipo === 'por_km') {
    return {
      ok: true,
      distanciaKm,
      taxaCentavos: regra.baseCentavos + Math.round(regra.porKmCentavos * distanciaKm),
    }
  }

  // faixas_km: a primeira faixa (ordenada) que comporta a distância.
  const faixa = [...regra.faixas]
    .sort((a, b) => a.ateKm - b.ateKm)
    .find((f) => distanciaKm <= f.ateKm)
  return faixa
    ? { ok: true, distanciaKm, taxaCentavos: faixa.taxaCentavos }
    : { ok: false, motivo: 'FORA_DA_AREA' }
}
