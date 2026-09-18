import { novoId } from './id.ts'
import type { PedidoCalculado } from './pedido.ts'

// Converte o pedido calculado nas linhas das tabelas `pedidos`, `itens_pedido` e
// `itens_pedido_componentes` (ver supabase/migrations). Os ids são gerados aqui para que
// as chaves estrangeiras já venham resolvidas e tudo possa ser gravado de uma vez.
// (Um teste em supabase/tests confere que estas linhas são aceitas pelo schema real.)

export type LinhaPedido = {
  id: string
  canal: 'proprio'
  cliente_nome: string
  cliente_telefone: string
  tipo: 'entrega' | 'retirada'
  status: 'aguardando_pagamento'
  pagamento_status: 'pendente'
  pagamento_metodo: 'pix'
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_complemento: string | null
  endereco_referencia: string | null
  distancia_km: number | null
  subtotal_centavos: number
  taxa_entrega_centavos: number
  desconto_centavos: number
  total_centavos: number
  observacoes: string | null
}

export type LinhaItem = {
  id: string
  pedido_id: string
  produto_id: string
  nome: string
  quantidade: number
  preco_unitario_centavos: number
  total_centavos: number
  observacoes: string | null
}

export type LinhaComponente = {
  id: string
  item_pedido_id: string
  produto_id: string | null
  grupo_nome: string
  opcao_nome: string
  quantidade: number
  preco_adicional_centavos: number
}

export type LinhasDoBanco = {
  pedido: LinhaPedido
  itens: LinhaItem[]
  componentes: LinhaComponente[]
}

export function montarLinhasDoBanco(
  p: PedidoCalculado,
  gerarId: () => string = novoId,
): LinhasDoBanco {
  const pedidoId = gerarId()
  const e = p.endereco
  const itens: LinhaItem[] = []
  const componentes: LinhaComponente[] = []

  for (const item of p.itens) {
    const itemId = gerarId()
    itens.push({
      id: itemId,
      pedido_id: pedidoId,
      produto_id: item.produtoId,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario_centavos: item.precoUnitarioCentavos,
      total_centavos: item.totalCentavos,
      observacoes: item.observacao ?? null,
    })
    for (const c of item.componentes) {
      componentes.push({
        id: gerarId(),
        item_pedido_id: itemId,
        produto_id: c.produtoId ?? null,
        grupo_nome: c.grupoNome,
        opcao_nome: c.opcaoNome,
        quantidade: c.quantidade,
        preco_adicional_centavos: c.precoAdicionalCentavos,
      })
    }
  }

  return {
    pedido: {
      id: pedidoId,
      canal: 'proprio',
      cliente_nome: p.cliente.nome,
      cliente_telefone: p.cliente.telefone,
      tipo: p.tipo,
      status: 'aguardando_pagamento',
      pagamento_status: 'pendente',
      pagamento_metodo: 'pix',
      endereco_rua: e?.rua ?? null,
      endereco_numero: e?.numero ?? null,
      endereco_bairro: e?.bairro ?? null,
      endereco_cidade: e?.cidade ?? null,
      endereco_complemento: e?.complemento ?? null,
      endereco_referencia: e?.referencia ?? null,
      distancia_km: p.distanciaKm ?? null,
      subtotal_centavos: p.subtotalCentavos,
      taxa_entrega_centavos: p.taxaEntregaCentavos,
      desconto_centavos: p.descontoCentavos,
      total_centavos: p.totalCentavos,
      observacoes: p.observacoes ?? null,
    },
    itens,
    componentes,
  }
}
