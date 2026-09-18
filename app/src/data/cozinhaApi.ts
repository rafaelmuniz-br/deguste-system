import type { SupabaseClient } from '@supabase/supabase-js'
import type { StatusPedido } from '../domain/andamento.ts'
import type { PedidoCozinha } from '../domain/cozinha.ts'

// Acesso do painel da cozinha ao banco. Quem lê/escreve aqui é um ADMIN logado (RLS: só admin lê
// pedidos e altera status). Atualização em tempo real via Supabase Realtime, com a tela também
// consultando de tempos em tempos como rede de segurança (ver pages/Cozinha.tsx).

export type ConexaoTempoReal = 'conectando' | 'conectado' | 'desconectado'

export type ProblemaImpressao = { numero: number; status: string; erro: string | null }

export type ResultadoMudanca = { ok: true } | { ok: false; motivo: 'conflito' | 'erro' }

export type ApiCozinha = {
  /** Pedidos PAGOS ainda em andamento (não inclui concluídos nem cancelados). */
  listar(): Promise<PedidoCozinha[]>
  /**
   * Muda o status só se o pedido ainda está em `de`. Se outra pessoa/aparelho já mudou, devolve
   * `conflito` (e ninguém sobrescreve o trabalho do outro).
   */
  mudarStatus(
    id: string,
    de: StatusPedido,
    para: StatusPedido,
    motivo?: string,
  ): Promise<ResultadoMudanca>
  reimprimir(id: string): Promise<boolean>
  /** Tempo de preparo da loja (configuração 1.12), usado para colorir os pedidos atrasados. */
  tempoPreparoMin(): Promise<number>
  problemasImpressao(): Promise<ProblemaImpressao[]>
  /** Avisa quando algo mudou e o estado da conexão. Devolve a função que desliga. */
  assinar(aoMudar: () => void, aoConexao: (c: ConexaoTempoReal) => void): () => void
}

type LinhaComponente = { grupo_nome: string; opcao_nome: string; quantidade: number }
type LinhaItem = {
  nome: string
  quantidade: number
  observacoes: string | null
  itens_pedido_componentes: LinhaComponente[] | null
}
export type LinhaPedido = {
  id: string
  numero: number | string
  created_at: string
  canal: PedidoCozinha['canal']
  tipo: PedidoCozinha['tipo']
  status: StatusPedido
  cliente_nome: string
  cliente_telefone: string
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_bairro: string | null
  endereco_complemento: string | null
  endereco_referencia: string | null
  observacoes: string | null
  total_centavos: number
  itens_pedido: LinhaItem[] | null
}

export function mapearPedido(l: LinhaPedido): PedidoCozinha {
  return {
    id: l.id,
    numero: Number(l.numero),
    criadoEm: l.created_at,
    canal: l.canal,
    tipo: l.tipo,
    status: l.status,
    clienteNome: l.cliente_nome,
    clienteTelefone: l.cliente_telefone,
    endereco: l.endereco_rua
      ? {
          rua: l.endereco_rua,
          numero: l.endereco_numero ?? undefined,
          bairro: l.endereco_bairro ?? undefined,
          complemento: l.endereco_complemento ?? undefined,
          referencia: l.endereco_referencia ?? undefined,
        }
      : undefined,
    observacoes: l.observacoes ?? undefined,
    totalCentavos: l.total_centavos,
    itens: (l.itens_pedido ?? []).map((i) => ({
      nome: i.nome,
      quantidade: i.quantidade,
      observacoes: i.observacoes ?? undefined,
      componentes: (i.itens_pedido_componentes ?? []).map((c) => ({
        grupo: c.grupo_nome,
        opcao: c.opcao_nome,
        quantidade: c.quantidade,
      })),
    })),
  }
}

const COLUNAS =
  'id, numero, created_at, canal, tipo, status, cliente_nome, cliente_telefone, endereco_rua, ' +
  'endereco_numero, endereco_bairro, endereco_complemento, endereco_referencia, observacoes, ' +
  'total_centavos, itens_pedido(nome, quantidade, observacoes, ' +
  'itens_pedido_componentes(grupo_nome, opcao_nome, quantidade))'

export function criarCozinhaSupabase(cliente: SupabaseClient): ApiCozinha {
  return {
    async listar() {
      const { data, error } = await cliente
        .from('pedidos')
        .select(COLUNAS)
        .eq('pagamento_status', 'pago')
        .in('status', ['novo', 'em_preparo', 'pronto', 'saiu_para_entrega'])
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return (data as unknown as LinhaPedido[]).map(mapearPedido)
    },

    async mudarStatus(id, de, para, motivo) {
      const { data, error } = await cliente
        .from('pedidos')
        .update({ status: para, ...(motivo ? { motivo_cancelamento: motivo } : {}) })
        .eq('id', id)
        .eq('status', de)
        .select('id')
      if (error) return { ok: false, motivo: 'erro' }
      return data && data.length > 0 ? { ok: true } : { ok: false, motivo: 'conflito' }
    },

    async tempoPreparoMin() {
      const { data, error } = await cliente
        .from('configuracoes_loja')
        .select('tempo_preparo_min')
        .eq('id', 1)
        .maybeSingle()
      if (error || !data) throw new Error(error?.message ?? 'sem configuração')
      return Number((data as { tempo_preparo_min: number }).tempo_preparo_min)
    },

    async reimprimir(id) {
      const { error } = await cliente.rpc('reimprimir_pedido', { p_pedido_id: id })
      return !error
    },

    async problemasImpressao() {
      const { data, error } = await cliente
        .from('impressoes_com_problema')
        .select('numero, status, erro')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return (data as { numero: number | string; status: string; erro: string | null }[]).map(
        (p) => ({
          numero: Number(p.numero),
          status: p.status,
          erro: p.erro,
        }),
      )
    },

    assinar(aoMudar, aoConexao) {
      const canal = cliente
        .channel('cozinha')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, aoMudar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'impressoes' }, aoMudar)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') aoConexao('conectado')
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
            aoConexao('desconectado')
          else aoConexao('conectando')
        })
      return () => {
        void cliente.removeChannel(canal)
      }
    },
  }
}
