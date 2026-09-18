import type { SupabaseClient } from '@supabase/supabase-js'
import type { DadosLoja } from '../domain/adminLoja.ts'
import type { ModoFuncionamento } from '../domain/tipos.ts'
import { resultado, type ResultadoSalvar } from './catalogoAdminApi.ts'

// Configurações da loja no painel admin. Leitura e gravação só de admin (RLS + função do banco).
// A gravação é UMA chamada (`salvar_configuracao_loja`): configuração e horários entram juntos ou nada muda.

export type ApiLojaAdmin = {
  carregar(): Promise<DadosLoja>
  salvar(dados: DadosLoja): Promise<ResultadoSalvar>
}

type LinhaLoja = {
  nome: string
  modo: ModoFuncionamento
  endereco: string | null
  latitude: number | null
  longitude: number | null
  frete_base_centavos: number
  frete_por_km_centavos: number
  raio_maximo_km: number | string
  pedido_minimo_centavos: number
  tempo_preparo_min: number
}

type LinhaHorario = { dia_semana: number; abre: string; fecha: string }

export function mapearLoja(l: LinhaLoja, horarios: LinhaHorario[]): DadosLoja {
  return {
    nome: l.nome,
    modo: l.modo,
    endereco: l.endereco,
    latitude: l.latitude,
    longitude: l.longitude,
    freteBaseCentavos: l.frete_base_centavos,
    fretePorKmCentavos: l.frete_por_km_centavos,
    raioMaximoKm: Number(l.raio_maximo_km), // numeric chega como texto
    pedidoMinimoCentavos: l.pedido_minimo_centavos,
    tempoPreparoMin: l.tempo_preparo_min,
    horarios: horarios.map((h) => ({
      dia: h.dia_semana,
      abre: h.abre.slice(0, 5),
      fecha: h.fecha.slice(0, 5),
    })),
  }
}

export function criarLojaAdminSupabase(cliente: SupabaseClient): ApiLojaAdmin {
  return {
    async carregar() {
      const [loja, horarios] = await Promise.all([
        cliente
          .from('configuracoes_loja')
          .select(
            'nome, modo, endereco, latitude, longitude, frete_base_centavos, frete_por_km_centavos, raio_maximo_km, pedido_minimo_centavos, tempo_preparo_min',
          )
          .eq('id', 1)
          .maybeSingle(),
        cliente
          .from('horarios_funcionamento')
          .select('dia_semana, abre, fecha')
          .order('dia_semana', { ascending: true })
          .order('abre', { ascending: true }),
      ])
      if (loja.error) throw new Error(loja.error.message)
      if (horarios.error) throw new Error(horarios.error.message)
      if (!loja.data) throw new Error('Configuração da loja não encontrada.')
      return mapearLoja(loja.data as LinhaLoja, horarios.data as LinhaHorario[])
    },

    async salvar(d) {
      const { error } = await cliente.rpc('salvar_configuracao_loja', {
        p_config: {
          nome: d.nome,
          modo: d.modo,
          endereco: d.endereco,
          latitude: d.latitude,
          longitude: d.longitude,
          frete_base_centavos: d.freteBaseCentavos,
          frete_por_km_centavos: d.fretePorKmCentavos,
          raio_maximo_km: d.raioMaximoKm,
          pedido_minimo_centavos: d.pedidoMinimoCentavos,
          tempo_preparo_min: d.tempoPreparoMin,
        },
        p_horarios: d.horarios.map((h) => ({ dia_semana: h.dia, abre: h.abre, fecha: h.fecha })),
      })
      return resultado(error)
    },
  }
}
