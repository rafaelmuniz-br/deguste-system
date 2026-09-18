import {
  calcularPedido,
  lerEntrada,
  type EnderecoEntrada,
  type ErroPedido,
} from '../domain/pedido.ts'
import { montarLinhasDoBanco, type LinhasDoBanco } from '../domain/pedidoBanco.ts'
import type { Cardapio, Coordenadas } from '../domain/tipos.ts'
import { criarLimitador } from './limitador.ts'

// Função do servidor que recebe pedidos (tarefa 3.7). POST { acao: 'calcular' | 'confirmar', pedido }.
//  - calcular:  valida, recalcula preço e frete e devolve o total para o cliente revisar. Não grava.
//  - confirmar: faz o mesmo cálculo DE NOVO e grava o pedido (aguardando pagamento).
// O corpo da requisição é tratado como não confiável: lerEntrada() descarta qualquer campo extra
// (preço, frete, total) e tudo é recalculado a partir do cardápio do banco.

export type Dependencias = {
  /** Cardápio SÓ com itens ativos (a service role ignora o RLS, então quem lê precisa filtrar). */
  carregarCardapio: () => Promise<Cardapio>
  /** Distância por ruas da loja ao endereço; null se não achou. */
  distanciaKm: (
    origem: Coordenadas | undefined,
    endereco: EnderecoEntrada,
  ) => Promise<number | null>
  /** Chama a função `criar_pedido` do banco. Deve lançar Error com a mensagem do banco se falhar. */
  criarPedidoNoBanco: (linhas: LinhasDoBanco) => Promise<{ numero: number; token: string }>
  agora?: () => Date
  /** Limitadores por IP (injetáveis para teste). */
  limitarCalcular?: (chave: string) => boolean
  limitarConfirmar?: (chave: string) => boolean
}

const TAMANHO_MAXIMO_BYTES = 20_000

const erro = (
  codigo: ErroPedido['codigo'],
  mensagem: string,
): { ok: false; erros: ErroPedido[] } => ({ ok: false, erros: [{ codigo, mensagem }] })

function responder(status: number, corpo: unknown, extras: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extras,
    },
  })
}

/** Qual IP fez a requisição. No Netlify o cabeçalho `x-nf-client-connection-ip` é definido pela plataforma. */
function origemDaRequisicao(req: Request): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconhecido'
  )
}

function statusDosErros(erros: ErroPedido[]): number {
  if (erros.some((e) => e.codigo === 'FORMATO_INVALIDO')) return 400
  return 422
}

export function criarHandler(deps: Dependencias) {
  const agora = deps.agora ?? (() => new Date())
  const limitarCalcular = deps.limitarCalcular ?? criarLimitador({ max: 30, janelaMs: 60_000 })
  const limitarConfirmar = deps.limitarConfirmar ?? criarLimitador({ max: 6, janelaMs: 60_000 })

  return async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return responder(405, erro('FORMATO_INVALIDO', 'Método não permitido.'), { Allow: 'POST' })
    }

    const declarado = Number(req.headers.get('content-length') ?? 0)
    if (declarado > TAMANHO_MAXIMO_BYTES) {
      return responder(413, erro('FORMATO_INVALIDO', 'Pedido grande demais.'))
    }
    const texto = await req.text()
    if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO_BYTES) {
      return responder(413, erro('FORMATO_INVALIDO', 'Pedido grande demais.'))
    }

    let corpo: unknown
    try {
      corpo = JSON.parse(texto)
    } catch {
      return responder(400, erro('FORMATO_INVALIDO', 'Pedido em formato inválido.'))
    }
    const acao = (corpo as { acao?: unknown } | null)?.acao
    if (acao !== 'calcular' && acao !== 'confirmar') {
      return responder(400, erro('FORMATO_INVALIDO', 'Ação inválida.'))
    }

    // Limite por origem (por instância; o limite que vale para todos fica no banco).
    const limitar = acao === 'confirmar' ? limitarConfirmar : limitarCalcular
    if (!limitar(`${origemDaRequisicao(req)}:${acao}`)) {
      return responder(
        429,
        erro('MUITAS_REQUISICOES', 'Muitas tentativas. Espere um minuto e tente de novo.'),
        { 'Retry-After': '60' },
      )
    }

    const leitura = lerEntrada((corpo as { pedido?: unknown }).pedido)
    if (!leitura.ok)
      return responder(statusDosErros(leitura.erros), { ok: false, erros: leitura.erros })

    let cardapio: Cardapio
    try {
      cardapio = await deps.carregarCardapio()
    } catch (e) {
      console.error(
        'pedidos: falha ao carregar o cardápio:',
        e instanceof Error ? e.message : 'erro',
      )
      return responder(
        503,
        erro(
          'SERVIDOR_INDISPONIVEL',
          'Não conseguimos processar agora. Tente de novo em instantes.',
        ),
      )
    }

    const origem = cardapio.loja.entrega.origem
    const calculo = await calcularPedido(leitura.entrada, {
      cardapio,
      agora: agora(),
      resolverDistanciaKm: (endereco) => deps.distanciaKm(origem, endereco),
    })
    if (!calculo.ok)
      return responder(statusDosErros(calculo.erros), { ok: false, erros: calculo.erros })

    if (acao === 'calcular') return responder(200, { ok: true, pedido: calculo.pedido })

    try {
      const { numero, token } = await deps.criarPedidoNoBanco(montarLinhasDoBanco(calculo.pedido))
      return responder(200, { ok: true, pedido: calculo.pedido, numero, token })
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : ''
      if (mensagem.includes('limite_pedidos_pendentes')) {
        return responder(
          429,
          erro(
            'MUITOS_PEDIDOS',
            'Você já tem pedidos aguardando pagamento. Conclua um deles ou espere alguns minutos.',
          ),
        )
      }
      // Não devolve detalhe do banco ao navegador; registra só o código, sem dados do cliente.
      // (números longos são mascarados para um telefone nunca ir parar em log)
      console.error(
        'pedidos: falha ao gravar o pedido:',
        mensagem.replace(/\d{6,}/g, '#').slice(0, 120),
      )
      return responder(
        500,
        erro(
          'SERVIDOR_INDISPONIVEL',
          'Não conseguimos registrar seu pedido agora. Tente de novo em instantes.',
        ),
      )
    }
  }
}
