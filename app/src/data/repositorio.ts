import { supabase } from '../lib/supabase.ts'
import type { Cardapio } from '../domain/tipos.ts'
import { cardapioExemplo } from './exemplo.ts'
import { carregarDoSupabase } from './supabaseRepo.ts'

/**
 * Único ponto de onde o app obtém o cardápio.
 *  - Com VITE_SUPABASE_URL/ANON_KEY configuradas: lê do banco. Se falhar, ERRA (a tela mostra
 *    "não conseguimos carregar") — nunca cai em dados falsos sem avisar.
 *  - Sem credenciais (ex.: quem acabou de clonar o projeto): usa o cardápio de exemplo.
 */
export async function carregarCardapio(): Promise<{ cardapio: Cardapio; ehExemplo: boolean }> {
  if (!supabase) return { cardapio: cardapioExemplo, ehExemplo: true }
  return { cardapio: await carregarDoSupabase(supabase), ehExemplo: false }
}
