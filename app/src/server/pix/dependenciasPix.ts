import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../dependenciasReais.ts'
import { criarGatewayMercadoPago } from './mercadoPago.ts'
import type { DependenciasPix, PedidoParaPix } from './pixHandlers.ts'

type Opcoes = {
  criarCliente?: (url: string, chave: string) => SupabaseClient
  fetchImpl?: typeof fetch
}

type LinhaPedido = {
  id: string
  numero: number | string
  total_centavos: number
  status: string
  pagamento_status: string
  pix_copia_cola: string | null
  pagamento_expira_em: string | null
}

/**
 * Liga as funções do Pix ao mundo real. Variáveis de ambiente (Netlify → Site settings → Environment):
 *  - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   como nas outras funções (chave SECRETA, só no servidor)
 *  - MP_ACCESS_TOKEN       token de acesso do Mercado Pago (SECRETO)
 *  - MP_WEBHOOK_SECRET     chave secreta do webhook (SECRETA)
 *  - SITE_URL              endereço público do site (ex.: https://deguste.netlify.app), para o aviso do gateway
 *  - PIX_EMAIL_PAGADOR     e-mail da loja usado como "pagador" exigido pela API (não é o do cliente)
 *
 * Falta configuração → lança erro → as funções respondem 502/503 sem vazar detalhe.
 */
export function criarDependenciasPix(env: Env, opcoes: Opcoes = {}): DependenciasPix {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const chave = env.SUPABASE_SERVICE_ROLE_KEY

  let cliente: SupabaseClient | null = null
  function obterCliente(): SupabaseClient {
    if (!url || !chave) throw new Error('Supabase não configurado no servidor')
    cliente ??= (
      opcoes.criarCliente ?? ((u, k) => createClient(u, k, { auth: { persistSession: false } }))
    )(url, chave)
    return cliente
  }

  function obterGateway() {
    const { MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SITE_URL, PIX_EMAIL_PAGADOR } = env
    if (!MP_ACCESS_TOKEN || !MP_WEBHOOK_SECRET || !SITE_URL || !PIX_EMAIL_PAGADOR) {
      throw new Error('Gateway de Pix não configurado no servidor')
    }
    return criarGatewayMercadoPago({
      accessToken: MP_ACCESS_TOKEN,
      webhookSecret: MP_WEBHOOK_SECRET,
      notificationUrl: `${SITE_URL.replace(/\/$/, '')}/.netlify/functions/webhook-pix`,
      emailPagador: PIX_EMAIL_PAGADOR,
      fetchImpl: opcoes.fetchImpl,
    })
  }
  let gateway: ReturnType<typeof obterGateway> | null = null

  return {
    // O gateway é criado só quando alguém usa: assim a falta de configuração vira erro tratado na
    // requisição (e não uma falha ao carregar a function).
    get gateway() {
      gateway ??= obterGateway()
      return gateway
    },

    async buscarPedidoPorToken(token): Promise<PedidoParaPix | null> {
      const { data, error } = await obterCliente()
        .from('pedidos')
        .select(
          'id, numero, total_centavos, status, pagamento_status, pix_copia_cola, pagamento_expira_em',
        )
        .eq('token_acompanhamento', token)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const l = data as LinhaPedido
      return {
        id: l.id,
        numero: Number(l.numero),
        totalCentavos: l.total_centavos,
        status: l.status,
        pagamentoStatus: l.pagamento_status,
        pixCopiaCola: l.pix_copia_cola,
        pagamentoExpiraEm: l.pagamento_expira_em,
      }
    },

    async registrarCobranca(pedidoId, cobranca) {
      const { data, error } = await obterCliente().rpc('registrar_cobranca_pix', {
        p_pedido_id: pedidoId,
        p_externo_id: cobranca.externoId,
        p_copia_cola: cobranca.copiaCola,
        p_expira_em: cobranca.expiraEm,
      })
      if (error) throw new Error(error.message)
      return data as Awaited<ReturnType<DependenciasPix['registrarCobranca']>>
    },

    async confirmarPagamento(externoId, valorCentavos) {
      const { data, error } = await obterCliente().rpc('confirmar_pagamento_pix', {
        p_externo_id: externoId,
        p_valor_centavos: valorCentavos,
      })
      if (error) throw new Error(error.message)
      return data as Awaited<ReturnType<DependenciasPix['confirmarPagamento']>>
    },
  }
}

/** Cancela pedidos não pagos (chamada pelo agendador a cada 5 minutos). Devolve quantos foram cancelados. */
export async function expirarPedidosPendentes(env: Env, opcoes: Opcoes = {}): Promise<number> {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const chave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('Supabase não configurado no servidor')
  const cliente = (
    opcoes.criarCliente ?? ((u, k) => createClient(u, k, { auth: { persistSession: false } }))
  )(url, chave)
  const { data, error } = await cliente.rpc('expirar_pedidos_pendentes', { p_minutos: 30 })
  if (error) throw new Error(error.message)
  return Number(data)
}
