import type { Cardapio } from '../domain/tipos.ts'
import { cardapioExemplo } from './exemplo.ts'

/**
 * Único ponto de onde o app obtém o cardápio. Hoje devolve dados de exemplo; quando o
 * Supabase estiver configurado (tarefa 1.7+), esta função passa a consultar o banco e
 * converter as linhas (snake_case) para `Cardapio` — o resto do app não muda.
 */
export async function carregarCardapio(): Promise<{ cardapio: Cardapio; ehExemplo: boolean }> {
  return { cardapio: cardapioExemplo, ehExemplo: true }
}
