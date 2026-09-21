import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  AvisoRecebido,
  CobrancaPix,
  GatewayPix,
  PagamentoConsultado,
  PedidoParaCobranca,
} from './gateway.ts'

// Adaptador do Mercado Pago (API de Pagamentos v1). ATENÇÃO: escrito a partir da documentação e testado
// com respostas simuladas; ainda NÃO foi validado contra o sandbox real (isso é a tarefa 3.2, depende
// da conta). Confira os pontos marcados com "SANDBOX:" na primeira execução de verdade.
//
// Segurança:
//  - O token de acesso vai só no cabeçalho Authorization (nunca na URL, nunca em log).
//  - O aviso (webhook) só é aceito se a assinatura `x-signature` (HMAC-SHA256 com o segredo do webhook) bater.
//  - Mesmo com assinatura válida, o estado do pagamento é CONSULTADO no Mercado Pago (não confiamos no aviso).

const API = 'https://api.mercadopago.com'

export type OpcoesMercadoPago = {
  accessToken: string
  /** "Chave secreta" do webhook (Suas integrações → Webhooks). */
  webhookSecret: string
  /** URL pública que o Mercado Pago chama (a function `webhook-pix`). */
  notificationUrl: string
  /** E-mail do pagador exigido pela API. Usamos um e-mail da própria loja (não coletamos e-mail do cliente). */
  emailPagador: string
  fetchImpl?: typeof fetch
  agora?: () => Date
}

/** 2026-09-18T20:30:00-03:00 (o Mercado Pago exige o deslocamento de fuso). */
function iso8601ComFuso(data: Date, deslocamentoMin = -180): string {
  const local = new Date(data.getTime() + deslocamentoMin * 60_000)
  const sinal = deslocamentoMin < 0 ? '-' : '+'
  const abs = Math.abs(deslocamentoMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${local.toISOString().slice(0, 23)}${sinal}${hh}:${mm}`
}

/** Id do pagamento citado no aviso: o da URL (?data.id=) e, se não houver, o do corpo (data.id). */
function idDoAviso({ url, corpo }: AvisoRecebido): string | null {
  const daUrl = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  if (daUrl) return daUrl
  try {
    const c = JSON.parse(corpo) as { data?: { id?: unknown } }
    return c.data?.id === undefined ? null : String(c.data.id)
  } catch {
    return null
  }
}

export function criarGatewayMercadoPago(opcoes: OpcoesMercadoPago): GatewayPix {
  const chamar = opcoes.fetchImpl ?? fetch
  const agora = opcoes.agora ?? (() => new Date())

  async function requisitar(
    caminho: string,
    init: { method: 'GET' | 'POST'; corpo?: unknown; idempotencia?: string },
  ): Promise<Record<string, unknown>> {
    const resposta = await chamar(`${API}${caminho}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${opcoes.accessToken}`,
        'Content-Type': 'application/json',
        ...(init.idempotencia ? { 'X-Idempotency-Key': init.idempotencia } : {}),
      },
      body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
    })
    // Nunca colocamos o corpo da resposta na mensagem: pode ter dado de pagamento.
    if (!resposta.ok) throw new Error(`Mercado Pago respondeu ${resposta.status}`)
    return (await resposta.json()) as Record<string, unknown>
  }

  return {
    nome: 'mercadopago',

    async criarCobranca(p: PedidoParaCobranca): Promise<CobrancaPix> {
      const vence = new Date(agora().getTime() + p.expiraEmMinutos * 60_000)
      const dados = await requisitar('/v1/payments', {
        method: 'POST',
        idempotencia: p.pedidoId,
        corpo: {
          // A API recebe reais com 2 casas (número). Centavos inteiros ÷ 100 → sem erro de ponto flutuante visível.
          transaction_amount: Number((p.valorCentavos / 100).toFixed(2)),
          description: `Pedido ${p.numero} - Deguste Burguer`,
          payment_method_id: 'pix',
          payer: { email: opcoes.emailPagador },
          date_of_expiration: iso8601ComFuso(vence),
          external_reference: p.pedidoId,
          notification_url: opcoes.notificationUrl,
        },
      })
      const transacao = (
        dados.point_of_interaction as { transaction_data?: { qr_code?: string } } | undefined
      )?.transaction_data
      const id = dados.id
      if ((typeof id !== 'number' && typeof id !== 'string') || !transacao?.qr_code) {
        // SANDBOX: confirmar que `point_of_interaction.transaction_data.qr_code` é o "copia e cola".
        throw new Error('Mercado Pago não devolveu o código Pix')
      }
      return {
        externoId: String(id),
        copiaCola: transacao.qr_code,
        expiraEm:
          typeof dados.date_of_expiration === 'string'
            ? new Date(dados.date_of_expiration).toISOString()
            : vence.toISOString(),
      }
    },

    validarAviso(aviso: AvisoRecebido): boolean {
      try {
        const { headers } = aviso
        const assinatura = headers.get('x-signature')
        const requestId = headers.get('x-request-id')
        if (!assinatura || !requestId || !opcoes.webhookSecret) return false

        const partes = Object.fromEntries(
          assinatura.split(',').map((kv) => {
            const i = kv.indexOf('=')
            return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
          }),
        )
        const ts = partes.ts
        const v1 = partes.v1
        if (!ts || !v1) return false

        // O id que entra na conta é o MESMO que usaremos depois (assinar um id e agir sobre outro seria brecha).
        const id = idDoAviso(aviso)?.toLowerCase()
        if (!id) return false

        const manifesto = `id:${id};request-id:${requestId};ts:${ts};`
        const esperado = createHmac('sha256', opcoes.webhookSecret).update(manifesto).digest('hex')
        const a = Buffer.from(esperado, 'utf8')
        const b = Buffer.from(v1, 'utf8')
        return a.length === b.length && timingSafeEqual(a, b)
      } catch {
        return false
      }
    },

    extrairPagamentoId(aviso: AvisoRecebido): string | null {
      const { url, corpo } = aviso
      let tipo = url.searchParams.get('type') ?? url.searchParams.get('topic')
      try {
        const c = JSON.parse(corpo) as { type?: string; topic?: string }
        tipo = tipo ?? c.type ?? c.topic ?? null
      } catch {
        // corpo vazio ou não-JSON: vale só o que veio na URL
      }
      const id = idDoAviso(aviso)
      if (tipo !== 'payment' || !id || !/^[0-9]{3,20}$/.test(id)) return null
      return id
    },

    async consultarPagamento(externoId: string): Promise<PagamentoConsultado> {
      if (!/^[0-9]{3,20}$/.test(externoId)) throw new Error('id de pagamento inválido')
      const dados = await requisitar(`/v1/payments/${externoId}`, { method: 'GET' })
      const status = String(dados.status ?? '')
      const valor = Number(dados.transaction_amount)
      if (!Number.isFinite(valor)) throw new Error('Mercado Pago não devolveu o valor')
      return {
        externoId,
        // SANDBOX: "approved" = pago e creditado. ("authorized"/"in_process" ainda não são dinheiro na conta.)
        aprovado: status === 'approved',
        valorCentavos: Math.round(valor * 100),
        statusBruto: status,
      }
    },
  }
}
