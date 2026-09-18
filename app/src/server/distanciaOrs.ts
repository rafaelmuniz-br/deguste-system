import { arredondarKm } from '../domain/frete.ts'
import type { EnderecoEntrada } from '../domain/pedido.ts'
import type { Coordenadas } from '../domain/tipos.ts'

// Distância por RUAS da loja até o endereço do cliente, via OpenRouteService (tem plano gratuito).
// Dois passos: (1) geocodificar o endereço em coordenadas; (2) pedir a rota de carro.
//
// STATUS: implementado conforme a documentação pública e testado com respostas simuladas.
// AINDA NÃO validado contra o serviço real (falta a chave ORS_API_KEY e o endereço da loja com
// coordenadas — ver tarefa 3.5). Qualquer falha devolve `null`, e o pedido é recusado com
// "não conseguimos localizar esse endereço" em vez de cobrar um frete chutado.

type Opcoes = {
  apiKey: string | undefined
  fetchImpl?: typeof fetch
  base?: string
  timeoutMs?: number
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function criarProvedorDistanciaOrs({
  apiKey,
  fetchImpl = fetch,
  base = 'https://api.openrouteservice.org',
  timeoutMs = 5000,
}: Opcoes) {
  // A chave vai no cabeçalho (não na URL), para não aparecer em logs de acesso.
  const cabecalhos = { Authorization: apiKey ?? '' }

  async function geocodificar(texto: string): Promise<Coordenadas | null> {
    const url = `${base}/geocode/search?text=${encodeURIComponent(texto)}&boundary.country=BR&size=1`
    const r = await fetchImpl(url, { headers: cabecalhos, signal: AbortSignal.timeout(timeoutMs) })
    if (!r.ok) return null
    const dados: unknown = await r.json()
    const coords = (dados as { features?: { geometry?: { coordinates?: unknown } }[] })
      .features?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || !ehNumero(coords[0]) || !ehNumero(coords[1])) return null
    return { longitude: coords[0], latitude: coords[1] }
  }

  async function rota(origem: Coordenadas, destino: Coordenadas): Promise<number | null> {
    const r = await fetchImpl(`${base}/v2/directions/driving-car`, {
      method: 'POST',
      headers: { ...cabecalhos, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [origem.longitude, origem.latitude],
          [destino.longitude, destino.latitude],
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!r.ok) return null
    const dados: unknown = await r.json()
    const metros = (dados as { routes?: { summary?: { distance?: unknown } }[] }).routes?.[0]
      ?.summary?.distance
    return ehNumero(metros) && metros >= 0 ? arredondarKm(metros / 1000) : null
  }

  return async function distanciaKm(
    origem: Coordenadas | undefined,
    endereco: EnderecoEntrada,
  ): Promise<number | null> {
    if (!apiKey || !origem) return null
    try {
      const texto = [
        `${endereco.rua}, ${endereco.numero}`,
        endereco.bairro,
        endereco.cidade ?? 'Salvador',
        'BA',
        'Brasil',
      ].join(', ')
      const destino = await geocodificar(texto)
      if (!destino) return null
      return await rota(origem, destino)
    } catch {
      // rede fora, timeout, resposta que não é JSON...
      return null
    }
  }
}
