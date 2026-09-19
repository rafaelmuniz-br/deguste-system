import type { PedidoExportado } from '../data/exportacaoApi.ts'
import { centavosParaCsv, gerarCsv, type Coluna } from './csv.ts'
import { dataHoraDaBahia, rotuloCanal, rotuloTipo } from './relatorios.ts'

const STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  novo: 'Novo',
  em_preparo: 'Em preparo',
  pronto: 'Pronto',
  saiu_para_entrega: 'Saiu para entrega',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}
const PAGAMENTO: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  expirado: 'Expirado',
  estornado: 'Estornado',
  falhou: 'Falhou',
}

const COLUNAS: Coluna<PedidoExportado>[] = [
  { titulo: 'Pedido', valor: (p) => p.numero },
  { titulo: 'Data e hora (Salvador)', valor: (p) => dataHoraDaBahia(p.criadoEm) },
  { titulo: 'Canal', valor: (p) => rotuloCanal(p.canal) },
  { titulo: 'Tipo', valor: (p) => rotuloTipo(p.tipo) },
  { titulo: 'Situação', valor: (p) => STATUS[p.status] ?? p.status },
  { titulo: 'Pagamento', valor: (p) => PAGAMENTO[p.pagamentoStatus] ?? p.pagamentoStatus },
  { titulo: 'Forma de pagamento', valor: (p) => p.pagamentoMetodo },
  { titulo: 'Bairro', valor: (p) => p.bairro },
  { titulo: 'Subtotal (R$)', valor: (p) => centavosParaCsv(p.subtotalCentavos) },
  { titulo: 'Taxa de entrega (R$)', valor: (p) => centavosParaCsv(p.taxaEntregaCentavos) },
  { titulo: 'Desconto (R$)', valor: (p) => centavosParaCsv(p.descontoCentavos) },
  { titulo: 'Total (R$)', valor: (p) => centavosParaCsv(p.totalCentavos) },
  { titulo: 'Itens', valor: (p) => p.itens },
]

/** CSV de pedidos do período, sem dado pessoal do cliente. Inclui TODOS os status (o contador filtra). */
export function pedidosParaCsv(pedidos: PedidoExportado[]): string {
  return gerarCsv(pedidos, COLUNAS)
}

export const nomeDoArquivo = (inicio: string, fim: string) =>
  inicio === fim ? `pedidos-deguste-${inicio}.csv` : `pedidos-deguste-${inicio}_a_${fim}.csv`
