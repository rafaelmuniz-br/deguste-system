import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarOpcoesAdminSupabase, mapearGrupo } from './opcoesAdminApi.ts'

type Chamada = [string, unknown[]]

/** Encadeador falso: cada `from()` consome a próxima resposta da fila e registra as chamadas. */
function clienteFalso(...respostas: unknown[]) {
  const chamadas: { tabela: string; passos: Chamada[] }[] = []
  const fila = [...respostas]
  const from = vi.fn((tabela: string) => {
    const registro = { tabela, passos: [] as Chamada[] }
    chamadas.push(registro)
    const resposta = fila.shift() ?? { data: null, error: null }
    const consulta: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
      consulta[m] = (...args: unknown[]) => {
        registro.passos.push([m, args])
        return consulta
      }
    }
    consulta.maybeSingle = () => Promise.resolve(resposta)
    consulta.then = (resolve: (v: unknown) => unknown) => resolve(resposta)
    return consulta
  })
  return { cliente: { from } as unknown as SupabaseClient, chamadas }
}

const passo = (c: { passos: Chamada[] }, metodo: string) =>
  c.passos.find(([m]) => m === metodo)?.[1]

const linhaGrupo = {
  id: 'g1',
  produto_id: 'p1',
  nome: 'Ponto',
  min_escolhas: 1,
  max_escolhas: 1,
  ordem: 10,
  opcoes: [
    {
      id: 'o2',
      grupo_id: 'g1',
      nome: 'B',
      preco_adicional_centavos: 0,
      produto_id: null,
      disponivel: true,
      ativo: true,
      ordem: 20,
    },
    {
      id: 'o1',
      grupo_id: 'g1',
      nome: 'A',
      preco_adicional_centavos: 350,
      produto_id: 'p9',
      disponivel: false,
      ativo: true,
      ordem: 10,
    },
  ],
}

describe('mapearGrupo', () => {
  it('converte e ordena as opções pela ordem', () => {
    const g = mapearGrupo(linhaGrupo)
    expect(g.opcoes.map((o) => o.id)).toEqual(['o1', 'o2'])
    expect(g.opcoes[0]).toEqual({
      id: 'o1',
      grupoId: 'g1',
      nome: 'A',
      precoAdicionalCentavos: 350,
      produtoId: 'p9',
      disponivel: false,
      ativo: true,
      ordem: 10,
    })
    expect(g.minEscolhas).toBe(1)
  })

  it('grupo sem opções vira lista vazia', () => {
    expect(mapearGrupo({ ...linhaGrupo, opcoes: null }).opcoes).toEqual([])
  })
})

describe('criarOpcoesAdminSupabase', () => {
  it('carregar: produto, grupos (com todas as opções, inclusive esgotadas) e produtos para vincular, sem o próprio', async () => {
    const { cliente, chamadas } = clienteFalso(
      { data: { id: 'p1', nome: 'Combo', eh_combo: true }, error: null },
      { data: [linhaGrupo], error: null },
      {
        data: [
          { id: 'p1', nome: 'Combo' },
          { id: 'p9', nome: 'Smash' },
        ],
        error: null,
      },
    )
    const r = await criarOpcoesAdminSupabase(cliente).carregar('p1')
    expect(r.produto).toEqual({ id: 'p1', nome: 'Combo', ehCombo: true })
    expect(r.grupos).toHaveLength(1)
    expect(r.produtos).toEqual([{ id: 'p9', nome: 'Smash' }]) // não oferece o combo dentro dele mesmo
    const grupos = chamadas.find((c) => c.tabela === 'grupos_opcao')!
    expect(passo(grupos, 'eq')).toEqual(['produto_id', 'p1'])
    // Não filtra por disponivel/ativo: o admin precisa ver tudo.
    expect(grupos.passos.some(([m, a]) => m === 'eq' && a[0] !== 'produto_id')).toBe(false)
  })

  it('carregar: produto inexistente ou erro do banco lança', async () => {
    const semProduto = clienteFalso(
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
    )
    await expect(criarOpcoesAdminSupabase(semProduto.cliente).carregar('x')).rejects.toThrow(
      /não encontrado/,
    )
    const erro = clienteFalso(
      { data: { id: 'p', nome: 'C', eh_combo: false }, error: null },
      { data: null, error: { message: 'rede' } },
      { data: [], error: null },
    )
    await expect(criarOpcoesAdminSupabase(erro.cliente).carregar('p')).rejects.toThrow('rede')
  })

  it('criar grupo: vai para o fim DENTRO do produto', async () => {
    const { cliente, chamadas } = clienteFalso(
      { data: [{ ordem: 30 }], error: null },
      { error: null },
    )
    const r = await criarOpcoesAdminSupabase(cliente).salvarGrupo('p1', {
      nome: 'Molhos',
      minEscolhas: 0,
      maxEscolhas: 2,
    })
    expect(r).toEqual({ ok: true })
    expect(passo(chamadas[0], 'eq')).toEqual(['produto_id', 'p1'])
    expect(passo(chamadas[1], 'insert')).toEqual([
      { nome: 'Molhos', min_escolhas: 0, max_escolhas: 2, produto_id: 'p1', ordem: 40 },
    ])
  })

  it('editar grupo não mexe na ordem nem no produto', async () => {
    const { cliente, chamadas } = clienteFalso({ error: null })
    await criarOpcoesAdminSupabase(cliente).salvarGrupo(
      'p1',
      { nome: 'X', minEscolhas: 1, maxEscolhas: 1 },
      'g7',
    )
    expect(passo(chamadas[0], 'update')).toEqual([{ nome: 'X', min_escolhas: 1, max_escolhas: 1 }])
    expect(passo(chamadas[0], 'eq')).toEqual(['id', 'g7'])
  })

  it('criar opção: vai para o fim DENTRO do grupo, com preço em centavos e produto real', async () => {
    const { cliente, chamadas } = clienteFalso({ data: [], error: null }, { error: null })
    await criarOpcoesAdminSupabase(cliente).salvarOpcao('g1', {
      nome: 'Smash',
      precoAdicionalCentavos: 350,
      produtoId: 'p9',
    })
    expect(passo(chamadas[0], 'eq')).toEqual(['grupo_id', 'g1'])
    expect(passo(chamadas[1], 'insert')).toEqual([
      {
        nome: 'Smash',
        preco_adicional_centavos: 350,
        produto_id: 'p9',
        grupo_id: 'g1',
        ordem: 10,
      },
    ])
  })

  it('editar opção não mexe em disponibilidade (esgotado tem botão próprio)', async () => {
    const { cliente, chamadas } = clienteFalso({ error: null })
    await criarOpcoesAdminSupabase(cliente).salvarOpcao(
      'g1',
      { nome: 'A', precoAdicionalCentavos: 0, produtoId: null },
      'o1',
    )
    const [linha] = passo(chamadas[0], 'update') as [Record<string, unknown>]
    expect(Object.keys(linha).sort()).toEqual(['nome', 'preco_adicional_centavos', 'produto_id'])
  })

  it('esgotado, excluir e reordenar chamam a tabela certa', async () => {
    const a = clienteFalso({ error: null })
    await criarOpcoesAdminSupabase(a.cliente).alterarDisponibilidade('o1', false)
    expect(a.chamadas[0].tabela).toBe('opcoes')
    expect(passo(a.chamadas[0], 'update')).toEqual([{ disponivel: false }])

    const b = clienteFalso({ error: null })
    await criarOpcoesAdminSupabase(b.cliente).excluirGrupo('g1')
    expect(b.chamadas[0].tabela).toBe('grupos_opcao')
    expect(b.chamadas[0].passos.some(([m]) => m === 'delete')).toBe(true)

    const c = clienteFalso({ error: null }, { error: null })
    const r = await criarOpcoesAdminSupabase(c.cliente).reordenarOpcoes(['x', 'y'])
    expect(r.ok).toBe(true)
    expect(c.chamadas.map((k) => [k.tabela, passo(k, 'update'), passo(k, 'eq')])).toEqual([
      ['opcoes', [{ ordem: 10 }], ['id', 'x']],
      ['opcoes', [{ ordem: 20 }], ['id', 'y']],
    ])
  })

  it('erro de permissão vira frase em português', async () => {
    const { cliente } = clienteFalso({ error: { code: '42501' } })
    expect(await criarOpcoesAdminSupabase(cliente).excluirOpcao('o1')).toEqual({
      ok: false,
      mensagem: expect.stringContaining('Sem permissão'),
    })
  })
})
