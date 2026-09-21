import { criarLimitador } from '../limitador.ts'
import type { CobrancaPix, GatewayPix } from './gateway.ts'

// Funções do servidor do pagamento por Pix (tarefas 3.8 e 3.9):
//   gerar-pix   POST { token }  → cria (ou devolve) a cobrança Pix do pedido.
//   webhook-pix POST (gateway)  → confirma o pagamento, com assinatura e consulta ao gateway.
// A regra de "está pago ou não" NÃO mora aqui: é do banco (confirmar_pagamento_pix). Ver docs/pagamento.md.

export type PedidoParaPix = {
  id: string
  numero: number
  totalCentavos: number
  status: string
  pagamentoStatus: string
  pixCopiaCola: string | null
  pagamentoExpiraEm: string | null
}

export type ResultadoRegistro =
  | 'registrada'
  | 'ja_registrada'
  | 'outra_cobranca_existente'
  | 'pedido_nao_aguarda_pagamento'
  | 'pedido_inexistente'

export type ResultadoConfirmacao =
  'confirmado' | 'ja_confirmado' | 'valor_divergente' | 'pago_apos_cancelamento' | 'desconhecido'

export type DependenciasPix = {
  gateway: GatewayPix
  /** Pedido pelo token de acompanhamento (o token é o "segredo" que só o cliente tem). */
  buscarPedidoPorToken: (token: string) => Promise<PedidoParaPix | null>
  registrarCobranca: (pedidoId: string, cobranca: CobrancaPix) => Promise<ResultadoRegistro>
  confirmarPagamento: (externoId: string, valorCentavos: number) => Promise<ResultadoConfirmacao>
  agora?: () => Date
  /** Minutos que o cliente tem para pagar (padrão 30). */
  expiraEmMinutos?: number
  limitarGerar?: (chave: string) => boolean
  /** Registro de acontecimentos importantes (sem dado pessoal). Padrão: console. */
  registrar?: (evento: string, dados: Record<string, unknown>) => void
}

const TAMANHO_MAXIMO_BYTES = 20_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function responder(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function origemDaRequisicao(req: Request): string {
  return (
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconhecido'
  )
}

async function lerCorpo(req: Request): Promise<string | 'grande_demais'> {
  const texto = await req.text()
  return new TextEncoder().encode(texto).length > TAMANHO_MAXIMO_BYTES ? 'grande_demais' : texto
}

// ---------------------------------------------------------------------------------------------
// gerar-pix
// ---------------------------------------------------------------------------------------------

export function criarHandlerGerarPix(dep: DependenciasPix): (req: Request) => Promise<Response> {
  const agora = dep.agora ?? (() => new Date())
  const minutos = dep.expiraEmMinutos ?? 30
  const limitar = dep.limitarGerar ?? criarLimitador({ max: 12, janelaMs: 60_000 })
  const registrar = dep.registrar ?? ((e, d) => console.warn(e, JSON.stringify(d)))

  return async (req) => {
    if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' })
    if (!limitar(origemDaRequisicao(req))) return responder(429, { erro: 'muitas_requisicoes' })

    const texto = await lerCorpo(req)
    if (texto === 'grande_demais') return responder(413, { erro: 'corpo_grande_demais' })
    let token: unknown
    try {
      token = (JSON.parse(texto) as { token?: unknown }).token
    } catch {
      return responder(400, { erro: 'json_invalido' })
    }
    // Token que nem parece um UUID nunca chega ao banco.
    if (typeof token !== 'string' || !UUID.test(token))
      return responder(400, { erro: 'token_invalido' })

    try {
      const pedido = await dep.buscarPedidoPorToken(token)
      if (!pedido) return responder(404, { erro: 'pedido_nao_encontrado' })
      if (pedido.status !== 'aguardando_pagamento' || pedido.pagamentoStatus !== 'pendente') {
        return responder(409, { erro: 'pedido_nao_aguarda_pagamento' })
      }

      // Já tem Pix: devolve o mesmo (recarregar a página não gera outra cobrança).
      if (pedido.pixCopiaCola) {
        const vence = pedido.pagamentoExpiraEm ? new Date(pedido.pagamentoExpiraEm) : null
        if (vence && vence.getTime() <= agora().getTime()) {
          return responder(409, { erro: 'pix_expirado' })
        }
        return responder(200, {
          copiaCola: pedido.pixCopiaCola,
          expiraEm: pedido.pagamentoExpiraEm,
        })
      }

      // O valor vem do BANCO (total do pedido), nunca do navegador.
      const cobranca = await dep.gateway.criarCobranca({
        pedidoId: pedido.id,
        numero: pedido.numero,
        valorCentavos: pedido.totalCentavos,
        expiraEmMinutos: minutos,
      })
      const resultado = await dep.registrarCobranca(pedido.id, cobranca)
      if (resultado === 'registrada' || resultado === 'ja_registrada') {
        return responder(200, { copiaCola: cobranca.copiaCola, expiraEm: cobranca.expiraEm })
      }
      registrar('gerar-pix: cobrança não registrada', { pedido: pedido.numero, resultado })
      return responder(409, { erro: resultado })
    } catch (e) {
      // Sem detalhe para o cliente (pode conter dado do gateway); o detalhe vai só para o log do servidor.
      registrar('gerar-pix: falha', { erro: e instanceof Error ? e.message : 'desconhecido' })
      return responder(502, { erro: 'nao_foi_possivel_gerar_pix' })
    }
  }
}

// ---------------------------------------------------------------------------------------------
// webhook-pix
// ---------------------------------------------------------------------------------------------

export function criarHandlerWebhookPix(dep: DependenciasPix): (req: Request) => Promise<Response> {
  const registrar = dep.registrar ?? ((e, d) => console.warn(e, JSON.stringify(d)))

  return async (req) => {
    if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' })

    const corpo = await lerCorpo(req)
    if (corpo === 'grande_demais') return responder(413, { erro: 'corpo_grande_demais' })
    const aviso = { headers: req.headers, url: new URL(req.url), corpo }

    try {
      // 1) Assinatura: aviso que não vem do gateway é recusado (401) e nada mais acontece.
      if (!dep.gateway.validarAviso(aviso)) {
        registrar('webhook-pix: assinatura inválida', { origem: origemDaRequisicao(req) })
        return responder(401, { erro: 'assinatura_invalida' })
      }

      // 2) Só nos interessa aviso de pagamento; o resto recebe 200 para o gateway não repetir.
      const externoId = dep.gateway.extrairPagamentoId(aviso)
      if (!externoId) return responder(200, { resultado: 'ignorado' })

      // 3) Não confiamos no conteúdo do aviso: perguntamos ao gateway o que aconteceu de verdade.
      const pagamento = await dep.gateway.consultarPagamento(externoId)
      if (!pagamento.aprovado) {
        return responder(200, { resultado: 'ignorado', status: pagamento.statusBruto })
      }

      // 4) Quem decide é o banco: idempotente, com trava de valor.
      const resultado = await dep.confirmarPagamento(pagamento.externoId, pagamento.valorCentavos)
      if (resultado === 'valor_divergente' || resultado === 'pago_apos_cancelamento') {
        // Precisa de uma pessoa (estorno/conferência): fica registrado no log e em pagamentos_para_revisar.
        registrar(`webhook-pix: ${resultado}`, { pagamento: pagamento.externoId })
      }
      return responder(200, { resultado })
    } catch (e) {
      // Falha nossa ou do gateway: 502 faz o gateway TENTAR DE NOVO mais tarde (o banco é idempotente).
      registrar('webhook-pix: falha ao processar', {
        erro: e instanceof Error ? e.message : 'desconhecido',
      })
      return responder(502, { erro: 'falha_ao_processar' })
    }
  }
}
