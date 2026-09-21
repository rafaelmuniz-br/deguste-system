import { vi } from 'vitest'
import type { ApiCatalogoAdmin } from '../data/catalogoAdminApi.ts'
import type { CategoriaAdmin, ProdutoAdmin } from '../domain/adminCatalogo.ts'

// API do cadastro em memória, para testar as telas do admin sem banco. Comporta-se como o banco real:
// exclusão de categoria com produtos é recusada, novo item vai para o fim, reordenar renumera.

export function catalogoAdminFalso(
  categoriasIniciais: CategoriaAdmin[] = [],
  produtosIniciais: ProdutoAdmin[] = [],
) {
  const estado = {
    categorias: [...categoriasIniciais],
    produtos: [...produtosIniciais],
    falhaAoListar: false,
    falhaAoSalvar: null as string | null,
    proximoId: 1,
  }
  const porOrdem = <T extends { ordem: number }>(l: T[]) => [...l].sort((a, b) => a.ordem - b.ordem)
  const recusa = () =>
    estado.falhaAoSalvar ? { ok: false as const, mensagem: estado.falhaAoSalvar } : null

  const api: ApiCatalogoAdmin = {
    listarCategorias: vi.fn(async () => {
      if (estado.falhaAoListar) throw new Error('rede')
      return porOrdem(estado.categorias)
    }),
    salvarCategoria: vi.fn(async (c, id) => {
      const r = recusa()
      if (r) return r
      if (id) {
        estado.categorias = estado.categorias.map((x) =>
          x.id === id ? { ...x, nome: c.nome, descricao: c.descricao ?? '', ativo: c.ativo } : x,
        )
      } else {
        const ordem = Math.max(0, ...estado.categorias.map((x) => x.ordem)) + 10
        estado.categorias.push({
          id: `nova-${estado.proximoId++}`,
          nome: c.nome,
          descricao: c.descricao ?? '',
          ativo: c.ativo,
          ordem,
        })
      }
      return { ok: true as const }
    }),
    excluirCategoria: vi.fn(async (id) => {
      if (estado.produtos.some((p) => p.categoriaId === id)) {
        return { ok: false as const, mensagem: 'Esta categoria ainda tem produtos.' }
      }
      estado.categorias = estado.categorias.filter((c) => c.id !== id)
      return { ok: true as const }
    }),
    reordenarCategorias: vi.fn(async (ids) => {
      estado.categorias = estado.categorias.map((c) => ({
        ...c,
        ordem: (ids.indexOf(c.id) + 1) * 10,
      }))
      return { ok: true as const }
    }),
    listarProdutos: vi.fn(async () => {
      if (estado.falhaAoListar) throw new Error('rede')
      return porOrdem(estado.produtos)
    }),
    salvarProduto: vi.fn(async (p, id) => {
      const r = recusa()
      if (r) return r
      if (id) {
        estado.produtos = estado.produtos.map((x) =>
          x.id === id
            ? {
                ...x,
                categoriaId: p.categoriaId,
                nome: p.nome,
                descricao: p.descricao ?? '',
                precoCentavos: p.precoCentavos,
                precoOriginalCentavos: p.precoOriginalCentavos,
                ehCombo: p.ehCombo,
                ativo: p.ativo,
              }
            : x,
        )
      } else {
        estado.produtos.push({
          id: `novo-${estado.proximoId++}`,
          categoriaId: p.categoriaId,
          nome: p.nome,
          descricao: p.descricao ?? '',
          precoCentavos: p.precoCentavos,
          precoOriginalCentavos: p.precoOriginalCentavos,
          fotoPath: null,
          ehCombo: p.ehCombo,
          disponivel: true,
          ativo: p.ativo,
          ordem: Math.max(0, ...estado.produtos.map((x) => x.ordem)) + 10,
        })
      }
      return { ok: true as const }
    }),
    alterarDisponibilidade: vi.fn(async (id, disponivel) => {
      estado.produtos = estado.produtos.map((p) => (p.id === id ? { ...p, disponivel } : p))
      return { ok: true as const }
    }),
    reordenarProdutos: vi.fn(async (ids) => {
      estado.produtos = estado.produtos.map((p) =>
        ids.includes(p.id) ? { ...p, ordem: (ids.indexOf(p.id) + 1) * 10 } : p,
      )
      return { ok: true as const }
    }),
  }
  return { api, estado }
}

export const categoria = (extra: Partial<CategoriaAdmin> = {}): CategoriaAdmin => ({
  id: 'c1',
  nome: 'Hambúrgueres',
  descricao: '',
  ordem: 10,
  ativo: true,
  ...extra,
})

export const produto = (extra: Partial<ProdutoAdmin> = {}): ProdutoAdmin => ({
  id: 'p1',
  categoriaId: 'c1',
  nome: 'Jackfino',
  descricao: 'Pão e carne',
  precoCentavos: 2190,
  precoOriginalCentavos: null,
  fotoPath: null,
  ehCombo: false,
  disponivel: true,
  ativo: true,
  ordem: 10,
  ...extra,
})
