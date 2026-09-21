import type { SupabaseClient } from '@supabase/supabase-js'
import { mapearRelatorio, type RelatorioBruto, type RelatorioVendas } from '../domain/relatorios.ts'

// Relatórios de vendas no painel admin. Os números são calculados no banco (função `relatorio_vendas`,
// só admin); aqui só chamamos e convertemos.

export type ApiRelatorios = {
  /** Datas no formato AAAA-MM-DD, no fuso da Bahia. Lança erro se o banco recusar ou a rede falhar. */
  vendas(inicio: string, fim: string): Promise<RelatorioVendas>
}

export function criarRelatoriosSupabase(cliente: SupabaseClient): ApiRelatorios {
  return {
    async vendas(inicio, fim) {
      const { data, error } = await cliente.rpc('relatorio_vendas', {
        p_inicio: inicio,
        p_fim: fim,
      })
      if (error) throw new Error(error.message)
      return mapearRelatorio(data as RelatorioBruto)
    },
  }
}
