import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CategoriaAdmin,
  CategoriaParaSalvar,
  ProdutoAdmin,
  ProdutoParaSalvar,
} from '../domain/adminCatalogo.ts'

// Acesso do painel admin ao cadastro (categorias e produtos). Quem escreve é um ADMIN logado:
// o RLS do banco só deixa admin gravar (supabase/migrations/*_rls.sql), então mesmo que alguém
// abra esta tela sem permissão, o banco recusa.

export type ResultadoSalvar = { ok: true } | { ok: false; mensagem: string }

export type ApiCatalogoAdmin = {
  /** Todas, inclusive as inativas (o público só enxerga as ativas). */
  listarCategorias(): Promise<CategoriaAdmin[]>
  /** `id` ausente = cria (vai para o fim da lista); com `id` = edita. */
  salvarCategoria(c: CategoriaParaSalvar, id?: string): Promise<ResultadoSalvar>
  /** Só apaga categoria vazia; com produtos, o banco recusa e devolvemos uma mensagem clara. */
  excluirCategoria(id: string): Promise<ResultadoSalvar>
  reordenarCategorias(idsEmOrdem: string[]): Promise<ResultadoSalvar>

  listarProdutos(): Promise<ProdutoAdmin[]>
  salvarProduto(p: ProdutoParaSalvar, id?: string): Promise<ResultadoSalvar>
  /** Atalho da cozinha: marcar/desmarcar "esgotado" sem abrir o formulário. */
  alterarDisponibilidade(id: string, disponivel: boolean): Promise<ResultadoSalvar>
  reordenarProdutos(idsEmOrdem: string[]): Promise<ResultadoSalvar>
}

type LinhaCategoria = {
  id: string
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
}

type LinhaProduto = {
  id: string
  categoria_id: string
  nome: string
  descricao: string | null
  preco_centavos: number
  preco_original_centavos: number | null
  foto_path: string | null
  eh_combo: boolean
  disponivel: boolean
  ativo: boolean
  ordem: number
}

export const mapearCategoria = (l: LinhaCategoria): CategoriaAdmin => ({
  id: l.id,
  nome: l.nome,
  descricao: l.descricao ?? '',
  ordem: l.ordem,
  ativo: l.ativo,
})

export const mapearProduto = (l: LinhaProduto): ProdutoAdmin => ({
  id: l.id,
  categoriaId: l.categoria_id,
  nome: l.nome,
  descricao: l.descricao ?? '',
  precoCentavos: l.preco_centavos,
  precoOriginalCentavos: l.preco_original_centavos,
  fotoPath: l.foto_path,
  ehCombo: l.eh_combo,
  disponivel: l.disponivel,
  ativo: l.ativo,
  ordem: l.ordem,
})

const FALHA = 'Não foi possível salvar agora. Confira a internet e tente de novo.'

/** Erro do Postgres → frase que a pessoa entende. */
export function traduzir(erro: { code?: string; message?: string }): string {
  if (erro.code === '23503') return 'Este item está em uso (tem produtos ou pedidos ligados a ele).'
  if (erro.code === '42501')
    return 'Sem permissão para alterar. Entre com uma conta de administrador.'
  if (erro.code === '23514')
    return 'Algum valor está fora do permitido. Confira os campos e tente de novo.'
  if (erro.code === '23505')
    return 'Já existe um item igual (por exemplo, dois horários começando na mesma hora).'
  return FALHA
}

export const resultado = (erro: { code?: string; message?: string } | null): ResultadoSalvar =>
  erro ? { ok: false, mensagem: traduzir(erro) } : { ok: true }

export function criarCatalogoAdminSupabase(cliente: SupabaseClient): ApiCatalogoAdmin {
  /** Grava a nova posição (10, 20, 30…) de cada id; deixa espaço entre elas para ajustes manuais. */
  async function reordenar(tabela: 'categorias' | 'produtos', ids: string[]) {
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

  async function proximaOrdem(tabela: 'categorias' | 'produtos'): Promise<number> {
    const { data } = await cliente
      .from(tabela)
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1)
    const maior = (data as { ordem: number }[] | null)?.[0]?.ordem ?? 0
    return maior + 10
  }

  return {
    async listarCategorias() {
      const { data, error } = await cliente
        .from('categorias')
        .select('id, nome, descricao, ordem, ativo')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return (data as LinhaCategoria[]).map(mapearCategoria)
    },

    async salvarCategoria(c, id) {
      if (id) {
        const { error } = await cliente.from('categorias').update(c).eq('id', id)
        return resultado(error)
      }
      const ordem = await proximaOrdem('categorias')
      const { error } = await cliente.from('categorias').insert({ ...c, ordem })
      return resultado(error)
    },

    async excluirCategoria(id) {
      const { error } = await cliente.from('categorias').delete().eq('id', id)
      if (error?.code === '23503') {
        return {
          ok: false,
          mensagem:
            'Esta categoria ainda tem produtos. Mude os produtos de categoria ou desative a categoria em vez de excluir.',
        }
      }
      return resultado(error)
    },

    reordenarCategorias: (ids) => reordenar('categorias', ids),

    async listarProdutos() {
      const { data, error } = await cliente
        .from('produtos')
        .select(
          'id, categoria_id, nome, descricao, preco_centavos, preco_original_centavos, foto_path, eh_combo, disponivel, ativo, ordem',
        )
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return (data as LinhaProduto[]).map(mapearProduto)
    },

    async salvarProduto(p, id) {
      const linha = {
        categoria_id: p.categoriaId,
        nome: p.nome,
        descricao: p.descricao,
        preco_centavos: p.precoCentavos,
        preco_original_centavos: p.precoOriginalCentavos,
        eh_combo: p.ehCombo,
        ativo: p.ativo,
      }
      if (id) {
        const { error } = await cliente.from('produtos').update(linha).eq('id', id)
        return resultado(error)
      }
      const ordem = await proximaOrdem('produtos')
      const { error } = await cliente.from('produtos').insert({ ...linha, ordem })
      return resultado(error)
    },

    async alterarDisponibilidade(id, disponivel) {
      const { error } = await cliente.from('produtos').update({ disponivel }).eq('id', id)
      return resultado(error)
    },

    reordenarProdutos: (ids) => reordenar('produtos', ids),
  }
}
