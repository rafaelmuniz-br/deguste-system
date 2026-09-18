import type { LinhaCarrinho } from './carrinho.ts'

export type Formulario = {
  nome: string
  telefone: string
  tipo: 'entrega' | 'retirada'
  rua: string
  numero: string
  bairro: string
  complemento: string
  referencia: string
  observacoes: string
}

export const formularioVazio: Formulario = {
  nome: '',
  telefone: '',
  tipo: 'entrega',
  rua: '',
  numero: '',
  bairro: '',
  complemento: '',
  referencia: '',
  observacoes: '',
}

/**
 * Monta o que o navegador ENVIA ao servidor: só "o que o cliente quer". Nunca inclui preço,
 * frete nem total — o servidor calcula tudo (ver domain/pedido.ts).
 */
export function montarPedidoBruto(f: Formulario, linhas: LinhaCarrinho[]) {
  return {
    cliente: { nome: f.nome, telefone: f.telefone },
    tipo: f.tipo,
    endereco:
      f.tipo === 'entrega'
        ? {
            rua: f.rua,
            numero: f.numero,
            bairro: f.bairro,
            complemento: f.complemento || undefined,
            referencia: f.referencia || undefined,
          }
        : undefined,
    itens: linhas.map((l) => ({
      produtoId: l.produtoId,
      quantidade: l.quantidade,
      escolhas: l.escolhas,
      observacao: l.observacao || undefined,
    })),
    observacoes: f.observacoes || undefined,
  }
}
