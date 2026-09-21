import type { StatusPedido, TipoPedido } from './andamento.ts'

// Regras do painel da cozinha (tarefas 4.1 a 4.5). Puras e testadas; a tela só as usa.

export type PedidoCozinha = {
  id: string
  numero: number
  criadoEm: string
  canal: 'proprio' | 'ifood' | '99food'
  tipo: TipoPedido
  status: StatusPedido
  clienteNome: string
  clienteTelefone: string
  endereco?: {
    rua?: string
    numero?: string
    bairro?: string
    complemento?: string
    referencia?: string
  }
  observacoes?: string
  totalCentavos: number
  itens: {
    nome: string
    quantidade: number
    observacoes?: string
    componentes: { grupo: string; opcao: string; quantidade: number }[]
  }[]
}

export type ColunaId = 'novos' | 'preparo' | 'prontos'

export const COLUNAS: { id: ColunaId; titulo: string; status: StatusPedido[] }[] = [
  { id: 'novos', titulo: 'Novos', status: ['novo'] },
  { id: 'preparo', titulo: 'Em preparo', status: ['em_preparo'] },
  { id: 'prontos', titulo: 'Prontos / a caminho', status: ['pronto', 'saiu_para_entrega'] },
]

/** Separa por coluna; dentro de cada uma, o mais antigo primeiro (quem espera há mais tempo aparece no topo). */
export function agrupar(pedidos: PedidoCozinha[]): Record<ColunaId, PedidoCozinha[]> {
  const ordenados = [...pedidos].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  const saida: Record<ColunaId, PedidoCozinha[]> = { novos: [], preparo: [], prontos: [] }
  for (const coluna of COLUNAS) {
    saida[coluna.id] = ordenados.filter((p) => coluna.status.includes(p.status))
  }
  return saida
}

export type Acao = { rotulo: string; para: StatusPedido }

/** O único próximo passo válido de cada pedido (não dá para pular etapas nem voltar). */
export function acaoPrincipal(p: Pick<PedidoCozinha, 'status' | 'tipo'>): Acao | null {
  switch (p.status) {
    case 'novo':
      return { rotulo: 'Aceitar e preparar', para: 'em_preparo' }
    case 'em_preparo':
      return { rotulo: 'Pronto', para: 'pronto' }
    case 'pronto':
      return p.tipo === 'entrega'
        ? { rotulo: 'Saiu para entrega', para: 'saiu_para_entrega' }
        : { rotulo: 'Entregue ao cliente', para: 'concluido' }
    case 'saiu_para_entrega':
      return { rotulo: 'Entregue', para: 'concluido' }
    default:
      return null
  }
}

/** Cancelar (ou recusar) é possível em qualquer pedido que ainda está em andamento. */
export const podeCancelar = (status: StatusPedido) =>
  status !== 'concluido' && status !== 'cancelado' && status !== 'aguardando_pagamento'

export const minutosDesde = (criadoEm: string, agora: Date): number =>
  Math.max(0, Math.floor((agora.getTime() - new Date(criadoEm).getTime()) / 60_000))

export type NivelAtraso = 'ok' | 'atencao' | 'atrasado'

/**
 * Cor de alerta do cartão: até 70% do tempo de preparo é normal; de 70% a 100% pede atenção;
 * passou do tempo prometido, está atrasado. Pedido já pronto/a caminho não conta.
 */
export function nivelDeAtraso(
  status: StatusPedido,
  minutos: number,
  tempoPreparoMin: number,
): NivelAtraso {
  if (status !== 'novo' && status !== 'em_preparo') return 'ok'
  if (minutos > tempoPreparoMin) return 'atrasado'
  if (minutos >= tempoPreparoMin * 0.7) return 'atencao'
  return 'ok'
}

/** Endereço numa linha só para buscadores de mapa: "Rua X, 10, Pituba, Salvador, BA, Brasil". Null se não há rua. */
function enderecoParaMapa(endereco: PedidoCozinha['endereco'], cidade: string): string | null {
  if (!endereco?.rua) return null
  return [
    `${endereco.rua}${endereco.numero ? `, ${endereco.numero}` : ''}`,
    endereco.bairro,
    cidade,
    'BA',
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')
}

/** Link do Google Maps com a rota até o cliente; null se não há endereço. Abre no celular do entregador. */
export function linkDaRota(
  endereco: PedidoCozinha['endereco'],
  cidade = 'Salvador',
): string | null {
  const destino = enderecoParaMapa(endereco, cidade)
  return destino
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`
    : null
}

/** Link do Waze (já começa a navegar); null se não há endereço. */
export function linkWaze(endereco: PedidoCozinha['endereco'], cidade = 'Salvador'): string | null {
  const destino = enderecoParaMapa(endereco, cidade)
  return destino ? `https://waze.com/ul?q=${encodeURIComponent(destino)}&navigate=yes` : null
}

/**
 * Texto para mandar ao entregador: número do pedido, quem receber, telefone, endereço com referência
 * e o link da rota. Só o necessário para a entrega (nada de valores nem itens do pedido).
 */
export function mensagemParaEntregador(
  p: Pick<PedidoCozinha, 'numero' | 'clienteNome' | 'clienteTelefone' | 'endereco'>,
  cidade = 'Salvador',
): string | null {
  const e = p.endereco
  const rota = linkDaRota(e, cidade)
  if (!e?.rua || !rota) return null
  const linhaEndereco = [
    `${e.rua}${e.numero ? `, ${e.numero}` : ''}`,
    e.bairro,
    e.complemento ? `(${e.complemento})` : null,
  ]
    .filter(Boolean)
    .join(' - ')
  return [
    `Entrega do pedido ${p.numero} - Deguste Burguer`,
    `Cliente: ${p.clienteNome} (${p.clienteTelefone})`,
    `Endereço: ${linhaEndereco}`,
    ...(e.referencia ? [`Referência: ${e.referencia}`] : []),
    `Rota: ${rota}`,
  ].join('\n')
}

/** Abre o WhatsApp para escolher o contato (o entregador) com o texto já pronto. */
export function linkWhatsapp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}
