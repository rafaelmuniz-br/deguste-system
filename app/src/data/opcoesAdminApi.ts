import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GrupoAdmin,
  GrupoParaSalvar,
  OpcaoAdmin,
  OpcaoParaSalvar,
} from '../domain/adminOpcoes.ts'
import { resultado, type ResultadoSalvar } from './catalogoAdminApi.ts'

// Grupos de opção e opções ("monte o seu", adicionais, combos) no painel admin. RLS: só admin escreve.
// Nomes e preços são COPIADOS para o pedido na hora da compra, então mudar ou apagar aqui não altera pedidos antigos.

export type ProdutoParaVinculo = { id: string; nome: string }

export type OpcoesDoProduto = {
  produto: { id: string; nome: string; ehCombo: boolean }
  grupos: GrupoAdmin[]
  /** Produtos que uma opção pode representar (combo: escolher o hambúrguer). */
  produtos: ProdutoParaVinculo[]
}

export type ApiOpcoesAdmin = {
  carregar(produtoId: string): Promise<OpcoesDoProduto>
  salvarGrupo(produtoId: string, g: GrupoParaSalvar, id?: string): Promise<ResultadoSalvar>
  /** Apaga o grupo e as opções dele. */
  excluirGrupo(id: string): Promise<ResultadoSalvar>
  reordenarGrupos(idsEmOrdem: string[]): Promise<ResultadoSalvar>
  salvarOpcao(grupoId: string, o: OpcaoParaSalvar, id?: string): Promise<ResultadoSalvar>
  excluirOpcao(id: string): Promise<ResultadoSalvar>
  /** Esgotado rápido de uma opção (ex.: acabou o bacon). */
  alterarDisponibilidade(id: string, disponivel: boolean): Promise<ResultadoSalvar>
  reordenarOpcoes(idsEmOrdem: string[]): Promise<ResultadoSalvar>
}

type LinhaOpcao = {
  id: string
  grupo_id: string
  nome: string
  preco_adicional_centavos: number
  produto_id: string | null
  disponivel: boolean
  ativo: boolean
  ordem: number
}

type LinhaGrupo = {
  id: string
  produto_id: string
  nome: string
  min_escolhas: number
  max_escolhas: number
  ordem: number
  opcoes: LinhaOpcao[] | null
}

const porOrdem = <T extends { ordem: number; nome: string }>(a: T, b: T) =>
  a.ordem - b.ordem || a.nome.localeCompare(b.nome)

export function mapearGrupo(l: LinhaGrupo): GrupoAdmin {
  const opcoes: OpcaoAdmin[] = (l.opcoes ?? []).map((o) => ({
    id: o.id,
    grupoId: o.grupo_id,
    nome: o.nome,
    precoAdicionalCentavos: o.preco_adicional_centavos,
    produtoId: o.produto_id,
    disponivel: o.disponivel,
    ativo: o.ativo,
    ordem: o.ordem,
  }))
  return {
    id: l.id,
    produtoId: l.produto_id,
    nome: l.nome,
    minEscolhas: l.min_escolhas,
    maxEscolhas: l.max_escolhas,
    ordem: l.ordem,
    opcoes: opcoes.sort(porOrdem),
  }
}

export function criarOpcoesAdminSupabase(cliente: SupabaseClient): ApiOpcoesAdmin {
  async function reordenar(tabela: 'grupos_opcao' | 'opcoes', ids: string[]) {
    const respostas = await Promise.all(
      ids.map((id, i) =>
        cliente
          .from(tabela)
          .update({ ordem: (i + 1) * 10 })
          .eq('id', id),
      ),
    )
    return resultado(respostas.find((r) => r.error)?.error ?? null)
  }

  /** Próxima posição dentro do "pai" (grupos do produto, opções do grupo). */
  async function proximaOrdem(tabela: 'grupos_opcao' | 'opcoes', coluna: string, paiId: string) {
    const { data } = await cliente
      .from(tabela)
      .select('ordem')
      .eq(coluna, paiId)
      .order('ordem', { ascending: false })
      .limit(1)
    return ((data as { ordem: number }[] | null)?.[0]?.ordem ?? 0) + 10
  }

  return {
    async carregar(produtoId) {
      const [produto, grupos, produtos] = await Promise.all([
        cliente.from('produtos').select('id, nome, eh_combo').eq('id', produtoId).maybeSingle(),
        cliente
          .from('grupos_opcao')
          .select(
            'id, produto_id, nome, min_escolhas, max_escolhas, ordem, opcoes(id, grupo_id, nome, preco_adicional_centavos, produto_id, disponivel, ativo, ordem)',
          )
          .eq('produto_id', produtoId),
        cliente.from('produtos').select('id, nome').order('nome', { ascending: true }),
      ])
      if (produto.error) throw new Error(produto.error.message)
      if (grupos.error) throw new Error(grupos.error.message)
      if (produtos.error) throw new Error(produtos.error.message)
      if (!produto.data) throw new Error('Produto não encontrado.')
      const p = produto.data as { id: string; nome: string; eh_combo: boolean }
      return {
        produto: { id: p.id, nome: p.nome, ehCombo: p.eh_combo },
        grupos: (grupos.data as LinhaGrupo[]).map(mapearGrupo).sort(porOrdem),
        produtos: (produtos.data as ProdutoParaVinculo[]).filter((x) => x.id !== produtoId),
      }
    },

    async salvarGrupo(produtoId, g, id) {
      const linha = { nome: g.nome, min_escolhas: g.minEscolhas, max_escolhas: g.maxEscolhas }
      if (id) {
        const { error } = await cliente.from('grupos_opcao').update(linha).eq('id', id)
        return resultado(error)
      }
      const ordem = await proximaOrdem('grupos_opcao', 'produto_id', produtoId)
      const { error } = await cliente
        .from('grupos_opcao')
        .insert({ ...linha, produto_id: produtoId, ordem })
      return resultado(error)
    },

    async excluirGrupo(id) {
      const { error } = await cliente.from('grupos_opcao').delete().eq('id', id)
      return resultado(error)
    },

    reordenarGrupos: (ids) => reordenar('grupos_opcao', ids),

    async salvarOpcao(grupoId, o, id) {
      const linha = {
        nome: o.nome,
        preco_adicional_centavos: o.precoAdicionalCentavos,
        produto_id: o.produtoId,
      }
      if (id) {
        const { error } = await cliente.from('opcoes').update(linha).eq('id', id)
        return resultado(error)
      }
      const ordem = await proximaOrdem('opcoes', 'grupo_id', grupoId)
      const { error } = await cliente.from('opcoes').insert({ ...linha, grupo_id: grupoId, ordem })
      return resultado(error)
    },

    async excluirOpcao(id) {
      const { error } = await cliente.from('opcoes').delete().eq('id', id)
      return resultado(error)
    },

    async alterarDisponibilidade(id, disponivel) {
      const { error } = await cliente.from('opcoes').update({ disponivel }).eq('id', id)
      return resultado(error)
    },

    reordenarOpcoes: (ids) => reordenar('opcoes', ids),
  }
}
