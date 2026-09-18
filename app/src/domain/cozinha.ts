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

/** Link do Google Maps com a rota até o cliente; null se não há endereço. Abre no celular do entregador. */
export function linkDaRota(
  endereco: PedidoCozinha['endereco'],
  cidade = 'Salvador',
): string | null {
  if (!endereco?.rua) return null
  const destino = [
    `${endereco.rua}${endereco.numero ? `, ${endereco.numero}` : ''}`,
    endereco.bairro,
    cidade,
    'BA',
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`
}
