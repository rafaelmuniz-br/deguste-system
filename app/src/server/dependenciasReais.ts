import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { carregarDoSupabase } from '../data/supabaseRepo.ts'
import { criarProvedorDistanciaOrs } from './distanciaOrs.ts'
import type { Dependencias } from './pedidosHandler.ts'

export type Env = Record<string, string | undefined>

type Opcoes = {
  criarCliente?: (url: string, chave: string) => SupabaseClient
  fetchImpl?: typeof fetch
}

/**
 * Liga o handler ao mundo real. Variáveis de ambiente (Netlify → Site settings → Environment):
 *  - SUPABASE_URL (ou VITE_SUPABASE_URL)  URL do projeto
 *  - SUPABASE_SERVICE_ROLE_KEY            chave SECRETA do servidor. Nunca no navegador, nunca no Git.
 *  - ORS_API_KEY                          chave do OpenRouteService (opcional: sem ela, regras de frete
 *                                         por distância recusam o pedido; a regra por bairro funciona)
 *
 * Se faltar configuração, as dependências lançam erro e o handler responde 503 (sem vazar detalhe).
 */
export function criarDependenciasReais(env: Env, opcoes: Opcoes = {}): Dependencias {
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

  return {
    carregarCardapio: async () => carregarDoSupabase(obterCliente()),
    distanciaKm: criarProvedorDistanciaOrs({
      apiKey: env.ORS_API_KEY,
      fetchImpl: opcoes.fetchImpl,
    }),
    async criarPedidoNoBanco(linhas) {
      const { data, error } = await obterCliente().rpc('criar_pedido', { p: linhas })
      if (error) throw new Error(error.message)
      const linha = Array.isArray(data) ? data[0] : data
      if (!linha?.o_token) throw new Error('resposta inesperada de criar_pedido')
      return { numero: Number(linha.o_numero), token: String(linha.o_token) }
    },
  }
}
