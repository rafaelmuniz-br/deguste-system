import { normalizarBairro } from '../domain/frete.ts'
import {
  calcularPedido,
  lerEntrada,
  type EnderecoEntrada,
  type ErroPedido,
  type PedidoCalculado,
} from '../domain/pedido.ts'
import type { Cardapio } from '../domain/tipos.ts'

// Contrato entre a tela de checkout e o servidor. Duas operações, e o servidor SEMPRE
// recalcula tudo a partir do cardápio do banco (nunca confia no que o navegador mostra):
//  - calcular:  mostra o total (com frete) para o cliente revisar; não grava nada.
//  - confirmar: recalcula de novo e cria o pedido (aguardando pagamento).

export type RespostaCalculo =
  { ok: true; pedido: PedidoCalculado } | { ok: false; erros: ErroPedido[] }

export type RespostaConfirmacao =
  | { ok: true; pedido: PedidoCalculado; numero: number; token?: string }
  | { ok: false; erros: ErroPedido[] }

export type ApiPedidos = {
  calcular(bruto: unknown): Promise<RespostaCalculo>
  confirmar(bruto: unknown): Promise<RespostaConfirmacao>
}

// ---------------------------------------------------------------------------------------------
// API SIMULADA — só para desenvolvimento com o cardápio de exemplo. Roda no navegador a mesma
// lógica que a função do servidor vai rodar (domain/pedido.ts), mas NÃO grava nem cobra nada.
// ---------------------------------------------------------------------------------------------

/** Distância fictícia. "Paripe" simula endereço fora da área; "Desconhecido", endereço não achado. */
export async function distanciaSimulada(endereco: EnderecoEntrada): Promise<number | null> {
  const bairro = normalizarBairro(endereco.bairro)
  if (bairro === 'paripe') return 12
  if (bairro === 'desconhecido') return null
  return 3.2
}

export function criarApiSimulada(
  cardapio: Cardapio,
  agora: () => Date = () => new Date(),
): ApiPedidos {
  let proximoNumero = 1001

  async function calcular(bruto: unknown): Promise<RespostaCalculo> {
    const leitura = lerEntrada(bruto)
    if (!leitura.ok) return { ok: false, erros: leitura.erros }
    return calcularPedido(leitura.entrada, {
      cardapio,
      agora: agora(),
      resolverDistanciaKm: distanciaSimulada,
    })
  }

  return {
    calcular,
    async confirmar(bruto) {
      const r = await calcular(bruto)
      return r.ok ? { ok: true, pedido: r.pedido, numero: proximoNumero++ } : r
    },
  }
}

// ---------------------------------------------------------------------------------------------
// API REAL — chama a Netlify Function (tarefa 3.7). O corpo é { acao, pedido } e a resposta
// tem o mesmo formato dos tipos acima.
// ---------------------------------------------------------------------------------------------

const ERRO_SERVIDOR: ErroPedido = {
  codigo: 'SERVIDOR_INDISPONIVEL',
  mensagem:
    'Não conseguimos enviar seu pedido agora. Tente de novo em instantes ou chame a gente no WhatsApp.',
}

export function criarApiHttp(endpoint = '/.netlify/functions/pedidos'): ApiPedidos {
  async function chamar(acao: 'calcular' | 'confirmar', bruto: unknown) {
    try {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, pedido: bruto }),
      })
      const dados: unknown = await resposta.json()
      if (typeof dados === 'object' && dados !== null && 'ok' in dados) {
        if (dados.ok === true && 'pedido' in dados) return dados
        if (dados.ok === false && 'erros' in dados && Array.isArray(dados.erros)) return dados
      }
    } catch {
      // rede fora do ar, resposta que não é JSON etc.
    }
    return { ok: false as const, erros: [ERRO_SERVIDOR] }
  }

  return {
    calcular: (bruto) => chamar('calcular', bruto) as Promise<RespostaCalculo>,
    confirmar: (bruto) => chamar('confirmar', bruto) as Promise<RespostaConfirmacao>,
  }
}
