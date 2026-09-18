// Como mostrar ao cliente o andamento do pedido (tarefa 3.10). Os valores de status são os mesmos
// dos tipos do banco (supabase/migrations/*_pedidos_e_clientes.sql).

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'novo'
  | 'em_preparo'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'concluido'
  | 'cancelado'

export type StatusPagamento = 'pendente' | 'pago' | 'expirado' | 'estornado' | 'falhou'

export type TipoPedido = 'entrega' | 'retirada'

export const PASSOS: Record<TipoPedido, string[]> = {
  entrega: [
    'Aguardando pagamento',
    'Pago',
    'Em preparo',
    'Pronto',
    'Saiu para entrega',
    'Entregue',
  ],
  retirada: ['Aguardando pagamento', 'Pago', 'Em preparo', 'Pronto para retirar', 'Retirado'],
}

/** Índice do passo atual em `PASSOS`, ou null se o pedido foi cancelado. */
export function passoAtual(tipo: TipoPedido, status: StatusPedido): number | null {
  const ultimo = PASSOS[tipo].length - 1
  switch (status) {
    case 'aguardando_pagamento':
      return 0
    case 'novo':
      return 1
    case 'em_preparo':
      return 2
    case 'pronto':
      return 3
    // Retirada não tem "saiu para entrega": continua em "pronto para retirar".
    case 'saiu_para_entrega':
      return tipo === 'entrega' ? 4 : 3
    case 'concluido':
      return ultimo
    case 'cancelado':
      return null
  }
}

/** Pedido que não muda mais (a tela pode parar de consultar). */
export const ehTerminal = (status: StatusPedido) => status === 'concluido' || status === 'cancelado'

export type Mensagem = { texto: string; alerta: boolean }

/** Frase principal para o cliente, considerando também a situação do pagamento. */
export function descreverAndamento(
  tipo: TipoPedido,
  status: StatusPedido,
  pagamento: StatusPagamento,
): Mensagem {
  if (status === 'cancelado') {
    return {
      texto:
        'Este pedido foi cancelado. Se você já pagou, o reembolso segue a nossa política de cancelamento.',
      alerta: true,
    }
  }
  if (status === 'aguardando_pagamento') {
    if (pagamento === 'expirado') {
      return {
        texto: 'O código Pix expirou e nada foi cobrado. Faça um novo pedido para continuar.',
        alerta: true,
      }
    }
    if (pagamento === 'falhou') {
      return { texto: 'O pagamento não foi concluído. Tente pedir novamente.', alerta: true }
    }
    return { texto: 'Aguardando a confirmação do seu pagamento.', alerta: false }
  }
  const textos: Record<Exclude<StatusPedido, 'aguardando_pagamento' | 'cancelado'>, string> = {
    novo: 'Pagamento confirmado! Seu pedido entrou na fila da cozinha.',
    em_preparo: 'Seu pedido está sendo preparado.',
    pronto:
      tipo === 'entrega'
        ? 'Seu pedido está pronto e vai sair para entrega.'
        : 'Seu pedido está pronto para retirada!',
    saiu_para_entrega:
      tipo === 'entrega'
        ? 'Seu pedido saiu para entrega.'
        : 'Seu pedido está pronto para retirada!',
    concluido:
      tipo === 'entrega' ? 'Pedido entregue. Bom apetite!' : 'Pedido retirado. Bom apetite!',
  }
  return { texto: textos[status], alerta: false }
}
