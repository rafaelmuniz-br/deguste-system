import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anon, clienteLogado, como, criarBanco } from './helpers.ts'

let db: PGlite

const pedidoRetirada = `
  insert into public.pedidos (cliente_nome, cliente_telefone, tipo, subtotal_centavos, total_centavos)
  values ('Fulano', '71999999999', 'retirada', 2199, 2199)`

beforeAll(async () => {
  db = await criarBanco()
  await db.exec(pedidoRetirada)
  await db.exec(`insert into public.clientes (nome, telefone) values ('Fulano', '71999999999')`)
  await db.exec(`insert into public.produtos (categoria_id, nome, preco_centavos, ativo)
    values ('00000000-0000-4000-8000-000000000002', 'Produto escondido', 1000, false)`)
}, 60_000)

afterAll(async () => {
  await db.close()
})

const contar = async (tabela: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from public.${tabela}`)).rows[0].n

describe('todas as tabelas têm RLS', () => {
  it('nenhuma tabela do schema public está sem RLS', async () => {
    const { rows } = await db.query<{ relname: string }>(`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
    expect(rows.map((r) => r.relname)).toEqual([])
  })
})

describe('visitante anônimo', () => {
  it('lê só o cardápio ativo', async () => {
    const produtos = await como(db, anon, () => db.query<{ nome: string }>(`select nome from public.produtos`))
    expect(produtos.rows.length).toBeGreaterThan(0)
    expect(produtos.rows.map((p) => p.nome)).not.toContain('Produto escondido')
    expect(await como(db, anon, () => contar('categorias'))).toBeGreaterThan(0)
    expect(await como(db, anon, () => contar('opcoes'))).toBeGreaterThan(0)
  })

  it('lê a configuração e o horário da loja', async () => {
    expect(await como(db, anon, () => contar('configuracoes_loja'))).toBe(1)
    expect(await como(db, anon, () => contar('horarios_funcionamento'))).toBe(5)
  })

  it.each(['pedidos', 'itens_pedido', 'itens_pedido_componentes', 'clientes', 'cupons', 'cashback_movimentos', 'admins'])(
    'não consegue nem consultar %s',
    async (tabela) => {
      await expect(como(db, anon, () => contar(tabela))).rejects.toThrow(/permission denied/)
    },
  )

  it('não consegue escrever no cardápio', async () => {
    await expect(
      como(db, anon, () => db.exec(`update public.produtos set preco_centavos = 1`)),
    ).rejects.toThrow(/permission denied/)
    await expect(
      como(db, anon, () => db.exec(`delete from public.categorias`)),
    ).rejects.toThrow(/permission denied/)
  })

  it('não consegue criar pedido direto (só a função server-side pode)', async () => {
    await expect(como(db, anon, () => db.exec(pedidoRetirada))).rejects.toThrow(/permission denied/)
  })
})

describe('usuário logado que NÃO é admin', () => {
  it('não vê pedidos nem clientes de ninguém', async () => {
    expect(await como(db, clienteLogado, () => contar('pedidos'))).toBe(0)
    expect(await como(db, clienteLogado, () => contar('clientes'))).toBe(0)
    expect(await como(db, clienteLogado, () => contar('cupons'))).toBe(0)
  })

  it('não consegue escrever no cardápio nem criar pedido', async () => {
    await expect(
      como(db, clienteLogado, () =>
        db.exec(`insert into public.categorias (nome) values ('Invasora')`),
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(como(db, clienteLogado, () => db.exec(pedidoRetirada))).rejects.toThrow(/row-level security/)
  })

  it('não consegue se promover a admin', async () => {
    await expect(
      como(db, clienteLogado, () =>
        db.exec(`insert into public.admins (user_id) values (auth.uid())`),
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('vê apenas a si mesmo na tabela admins (ou nada)', async () => {
    expect(await como(db, clienteLogado, () => contar('admins'))).toBe(0)
  })
})

describe('admin', () => {
  it('lê pedidos, clientes e produtos escondidos', async () => {
    expect(await como(db, admin, () => contar('pedidos'))).toBe(1)
    expect(await como(db, admin, () => contar('clientes'))).toBe(1)
    const nomes = await como(db, admin, () => db.query<{ nome: string }>(`select nome from public.produtos`))
    expect(nomes.rows.map((p) => p.nome)).toContain('Produto escondido')
  })

  it('escreve no cardápio e atualiza status do pedido', async () => {
    await como(db, admin, async () => {
      await db.exec(`update public.produtos set preco_centavos = 2299 where nome = 'Smash Exemplo'`)
      await db.exec(`update public.pedidos set status = 'novo'`)
    })
    const { rows } = await db.query<{ preco_centavos: number }>(
      `select preco_centavos from public.produtos where nome = 'Smash Exemplo'`,
    )
    expect(rows[0].preco_centavos).toBe(2299)
  })

  it('enxerga a própria linha em admins', async () => {
    expect(await como(db, admin, () => contar('admins'))).toBe(1)
  })
})
