import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarCatalogoAdminSupabase, mapearCategoria, mapearProduto } from './catalogoAdminApi.ts'

type Chamada = [string, unknown[]]

/** Encadeador falso: registra as chamadas e devolve a próxima resposta da fila (é "thenable" como o do Supabase). */
function clienteFalso(...respostas: unknown[]) {
  const chamadas: { tabela: string; passos: Chamada[] }[] = []
  const fila = [...respostas]
  const from = vi.fn((tabela: string) => {
    const registro = { tabela, passos: [] as Chamada[] }
    chamadas.push(registro)
    const consulta: Record<string, unknown> = {}
    for (const metodo of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
      consulta[metodo] = (...args: unknown[]) => {
        registro.passos.push([metodo, args])
        return consulta
      }
    }
    const resposta = fila.shift() ?? { data: null, error: null }
    consulta.then = (resolve: (v: unknown) => unknown) => resolve(resposta)
    return consulta
  })
  return { cliente: { from } as unknown as SupabaseClient, chamadas }
}

const passo = (c: { passos: Chamada[] }, metodo: string) =>
  c.passos.find(([m]) => m === metodo)?.[1]

describe('mapeadores', () => {
  it('categoria sem descrição vira texto vazio (o formulário não trabalha com null)', () => {
    expect(
      mapearCategoria({ id: 'c', nome: 'A', descricao: null, ordem: 10, ativo: true }),
    ).toEqual({ id: 'c', nome: 'A', descricao: '', ordem: 10, ativo: true })
  })

  it('produto: colunas do banco viram o modelo da tela', () => {
    expect(
      mapearProduto({
        id: 'p',
        categoria_id: 'c',
        nome: 'X',
        descricao: null,
        preco_centavos: 2190,
        preco_original_centavos: 2590,
        foto_path: null,
        eh_combo: true,
        disponivel: false,
        ativo: true,
        ordem: 5,
      }),
    ).toEqual({
      id: 'p',
      categoriaId: 'c',
      nome: 'X',
      descricao: '',
      precoCentavos: 2190,
      precoOriginalCentavos: 2590,
      fotoPath: null,
      ehCombo: true,
      disponivel: false,
      ativo: true,
      ordem: 5,
    })
  })
})

describe('categorias', () => {
  it('listar traz inclusive as inativas, na ordem certa', async () => {
    const { cliente, chamadas } = clienteFalso({
      data: [{ id: 'c1', nome: 'A', descricao: null, ordem: 10, ativo: false }],
      error: null,
    })
    const lista = await criarCatalogoAdminSupabase(cliente).listarCategorias()
    expect(lista).toHaveLength(1)
    expect(chamadas[0].passos.some(([m, a]) => m === 'eq' && a[0] === 'ativo')).toBe(false)
    expect(chamadas[0].passos).toContainEqual(['order', ['ordem', { ascending: true }]])
  })

  it('listar com erro do banco lança (a tela mostra "não foi possível carregar")', async () => {
    const { cliente } = clienteFalso({ data: null, error: { message: 'rede' } })
    await expect(criarCatalogoAdminSupabase(cliente).listarCategorias()).rejects.toThrow('rede')
  })

  it('criar: vai para o fim (maior ordem + 10)', async () => {
    const { cliente, chamadas } = clienteFalso(
      { data: [{ ordem: 40 }], error: null }, // proximaOrdem
      { error: null }, // insert
    )
    const r = await criarCatalogoAdminSupabase(cliente).salvarCategoria({
      nome: 'Nova',
      descricao: null,
      ativo: true,
    })
    expect(r).toEqual({ ok: true })
    expect(passo(chamadas[1], 'insert')).toEqual([
      { nome: 'Nova', descricao: null, ativo: true, ordem: 50 },
    ])
  })

  it('criar a primeira categoria: começa em 10', async () => {
    const { cliente, chamadas } = clienteFalso({ data: [], error: null }, { error: null })
    await criarCatalogoAdminSupabase(cliente).salvarCategoria({
      nome: 'Nova',
      descricao: null,
      ativo: true,
    })
    expect(passo(chamadas[1], 'insert')).toEqual([expect.objectContaining({ ordem: 10 })])
  })

  it('editar: atualiza só aquele id', async () => {
    const { cliente, chamadas } = clienteFalso({ error: null })
    await criarCatalogoAdminSupabase(cliente).salvarCategoria(
      { nome: 'B', descricao: 'x', ativo: false },
      'c9',
    )
    expect(passo(chamadas[0], 'update')).toEqual([{ nome: 'B', descricao: 'x', ativo: false }])
    expect(passo(chamadas[0], 'eq')).toEqual(['id', 'c9'])
  })

  it('excluir categoria com produtos: mensagem clara em vez do erro técnico', async () => {
    const { cliente } = clienteFalso({ error: { code: '23503', message: 'fk' } })
    const r = await criarCatalogoAdminSupabase(cliente).excluirCategoria('c1')
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('ainda tem produtos') })
  })

  it('sem permissão (RLS): mensagem em português', async () => {
    const { cliente } = clienteFalso({ error: { code: '42501', message: 'rls' } })
    const r = await criarCatalogoAdminSupabase(cliente).salvarCategoria(
      { nome: 'B', descricao: null, ativo: true },
      'c1',
    )
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('Sem permissão') })
  })

  it('reordenar grava 10, 20, 30… na ordem recebida; qualquer falha é reportada', async () => {
    const { cliente, chamadas } = clienteFalso(
      { error: null },
      { error: { message: 'x' } },
      { error: null },
    )
    const r = await criarCatalogoAdminSupabase(cliente).reordenarCategorias(['a', 'b', 'c'])
    expect(chamadas.map((c) => [passo(c, 'update'), passo(c, 'eq')])).toEqual([
      [[{ ordem: 10 }], ['id', 'a']],
      [[{ ordem: 20 }], ['id', 'b']],
      [[{ ordem: 30 }], ['id', 'c']],
    ])
    expect(r.ok).toBe(false)
  })
})

describe('produtos', () => {
  const novo = {
    categoriaId: 'c1',
    nome: 'Jackfino',
    descricao: null,
    precoCentavos: 2190,
    precoOriginalCentavos: null,
    ehCombo: false,
    ativo: true,
  }

  it('criar grava preço em centavos e vai para o fim', async () => {
    const { cliente, chamadas } = clienteFalso(
      { data: [{ ordem: 20 }], error: null },
      { error: null },
    )
    const r = await criarCatalogoAdminSupabase(cliente).salvarProduto(novo)
    expect(r).toEqual({ ok: true })
    expect(passo(chamadas[1], 'insert')).toEqual([
      {
        categoria_id: 'c1',
        nome: 'Jackfino',
        descricao: null,
        preco_centavos: 2190,
        preco_original_centavos: null,
        eh_combo: false,
        ativo: true,
        ordem: 30,
      },
    ])
  })

  it('editar não mexe em ordem, foto nem disponibilidade', async () => {
    const { cliente, chamadas } = clienteFalso({ error: null })
    await criarCatalogoAdminSupabase(cliente).salvarProduto(novo, 'p1')
    const [linha] = passo(chamadas[0], 'update') as [Record<string, unknown>]
    expect(Object.keys(linha)).not.toContain('ordem')
    expect(Object.keys(linha)).not.toContain('foto_path')
    expect(Object.keys(linha)).not.toContain('disponivel')
  })

  it('esgotado rápido: só muda "disponivel" daquele produto', async () => {
    const { cliente, chamadas } = clienteFalso({ error: null })
    const r = await criarCatalogoAdminSupabase(cliente).alterarDisponibilidade('p1', false)
    expect(r).toEqual({ ok: true })
    expect(passo(chamadas[0], 'update')).toEqual([{ disponivel: false }])
    expect(passo(chamadas[0], 'eq')).toEqual(['id', 'p1'])
  })

  it('falha de rede ao salvar: mensagem genérica que orienta a tentar de novo', async () => {
    const { cliente } = clienteFalso({ error: { message: 'timeout' } })
    const r = await criarCatalogoAdminSupabase(cliente).alterarDisponibilidade('p1', true)
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('tente de novo') })
  })
})
