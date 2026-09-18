import { vi } from 'vitest'
import type { ApiOpcoesAdmin } from '../data/opcoesAdminApi.ts'
import type { GrupoAdmin, OpcaoAdmin } from '../domain/adminOpcoes.ts'

// API de opções em memória, para testar a tela sem banco. Comporta-se como o banco: novo item vai
// para o fim, reordenar renumera, excluir grupo leva as opções junto.

export const opcao = (extra: Partial<OpcaoAdmin> = {}): OpcaoAdmin => ({
  id: 'o1',
  grupoId: 'g1',
  nome: 'Ao ponto',
  precoAdicionalCentavos: 0,
  produtoId: null,
  disponivel: true,
  ativo: true,
  ordem: 10,
  ...extra,
})

export const grupo = (extra: Partial<GrupoAdmin> = {}): GrupoAdmin => ({
  id: 'g1',
  produtoId: 'p1',
  nome: 'Ponto da carne',
  minEscolhas: 1,
  maxEscolhas: 1,
  ordem: 10,
  opcoes: [],
  ...extra,
})

export function opcoesAdminFalso(
  grupos: GrupoAdmin[] = [],
  opts: { ehCombo?: boolean; falhaAoCarregar?: boolean } = {},
) {
  const estado = {
    grupos: grupos.map((g) => ({ ...g, opcoes: [...g.opcoes] })),
    falhaAoCarregar: opts.falhaAoCarregar ?? false,
    falhaAoSalvar: null as string | null,
    proximoId: 1,
  }
  const recusa = () =>
    estado.falhaAoSalvar ? { ok: false as const, mensagem: estado.falhaAoSalvar } : null
  const ordenar = <T extends { ordem: number }>(l: T[]) => [...l].sort((a, b) => a.ordem - b.ordem)
  const ok = { ok: true as const }

  const api: ApiOpcoesAdmin = {
    carregar: vi.fn(async (produtoId: string) => {
      if (estado.falhaAoCarregar) throw new Error('rede')
      return {
        produto: { id: produtoId, nome: 'Combo Smash', ehCombo: opts.ehCombo ?? false },
        grupos: ordenar(estado.grupos).map((g) => ({ ...g, opcoes: ordenar(g.opcoes) })),
        produtos: [
          { id: 'p-smash', nome: 'Smash' },
          { id: 'p-jack', nome: 'Jackfino' },
        ],
      }
    }),
    salvarGrupo: vi.fn(async (produtoId, g, id) => {
      const r = recusa()
      if (r) return r
      if (id) {
        estado.grupos = estado.grupos.map((x) => (x.id === id ? { ...x, ...g } : x))
      } else {
        estado.grupos.push({
          id: `g-novo-${estado.proximoId++}`,
          produtoId,
          ...g,
          ordem: Math.max(0, ...estado.grupos.map((x) => x.ordem)) + 10,
          opcoes: [],
        })
      }
      return ok
    }),
    excluirGrupo: vi.fn(async (id) => {
      estado.grupos = estado.grupos.filter((g) => g.id !== id)
      return ok
    }),
    reordenarGrupos: vi.fn(async (ids) => {
      estado.grupos = estado.grupos.map((g) => ({ ...g, ordem: (ids.indexOf(g.id) + 1) * 10 }))
      return ok
    }),
    salvarOpcao: vi.fn(async (grupoId, o, id) => {
      const r = recusa()
      if (r) return r
      estado.grupos = estado.grupos.map((g) => {
        if (id) {
          return { ...g, opcoes: g.opcoes.map((x) => (x.id === id ? { ...x, ...o } : x)) }
        }
        if (g.id !== grupoId) return g
        const ordem = Math.max(0, ...g.opcoes.map((x) => x.ordem)) + 10
        return {
          ...g,
          opcoes: [
            ...g.opcoes,
            {
              id: `o-novo-${estado.proximoId++}`,
              grupoId,
              ...o,
              disponivel: true,
              ativo: true,
              ordem,
            },
          ],
        }
      })
      return ok
    }),
    excluirOpcao: vi.fn(async (id) => {
      estado.grupos = estado.grupos.map((g) => ({
        ...g,
        opcoes: g.opcoes.filter((o) => o.id !== id),
      }))
      return ok
    }),
    alterarDisponibilidade: vi.fn(async (id, disponivel) => {
      estado.grupos = estado.grupos.map((g) => ({
        ...g,
        opcoes: g.opcoes.map((o) => (o.id === id ? { ...o, disponivel } : o)),
      }))
      return ok
    }),
    reordenarOpcoes: vi.fn(async (ids) => {
      estado.grupos = estado.grupos.map((g) => ({
        ...g,
        opcoes: g.opcoes.map((o) =>
          ids.includes(o.id) ? { ...o, ordem: (ids.indexOf(o.id) + 1) * 10 } : o,
        ),
      }))
      return ok
    }),
  }
  return { api, estado }
}
