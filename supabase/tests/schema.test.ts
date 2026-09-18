import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarBanco } from './helpers.ts'

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

const inserirPedido = (campos: string, valores: string) =>
  db.exec(`insert into public.pedidos (cliente_nome, cliente_telefone, ${campos}) values ('Fulano', '71999999999', ${valores})`)

describe('regras de integridade dos pedidos', () => {
  it('rejeita total diferente de subtotal + entrega - desconto', async () => {
    await expect(
      inserirPedido('tipo, subtotal_centavos, total_centavos', `'retirada', 2000, 2500`),
    ).rejects.toThrow(/check/)
  })

  it('aceita retirada sem endereço e fecha a conta com frete e desconto', async () => {
    await inserirPedido('tipo, subtotal_centavos, total_centavos', `'retirada', 2000, 2000`)
    await inserirPedido(
      'tipo, endereco_rua, subtotal_centavos, taxa_entrega_centavos, desconto_centavos, total_centavos',
      `'entrega', 'Rua A', 2000, 500, 200, 2300`,
    )
  })

  it('rejeita entrega sem endereço', async () => {
    await expect(
      inserirPedido('tipo, subtotal_centavos, total_centavos', `'entrega', 2000, 2000`),
    ).rejects.toThrow(/check/)
  })

  it('exige motivo para pedido cancelado', async () => {
    await expect(
      inserirPedido('tipo, status, subtotal_centavos, total_centavos', `'retirada', 'cancelado', 1000, 1000`),
    ).rejects.toThrow(/check/)
  })

  it('impede o mesmo pedido externo (iFood) de entrar duas vezes, mas permite em canais diferentes', async () => {
    const campos = 'canal, canal_pedido_externo_id, tipo, subtotal_centavos, total_centavos'
    await inserirPedido(campos, `'ifood', 'ABC123', 'retirada', 1000, 1000`)
    await expect(inserirPedido(campos, `'ifood', 'ABC123', 'retirada', 1000, 1000`)).rejects.toThrow(/unique|duplicate/)
    await inserirPedido(campos, `'99food', 'ABC123', 'retirada', 1000, 1000`)
  })

  it('impede dois pedidos com a mesma cobrança Pix (idempotência do webhook)', async () => {
    const campos = 'pagamento_externo_id, tipo, subtotal_centavos, total_centavos'
    await inserirPedido(campos, `'pix-1', 'retirada', 1000, 1000`)
    await expect(inserirPedido(campos, `'pix-1', 'retirada', 1000, 1000`)).rejects.toThrow(/unique|duplicate/)
  })

  it('só aceita telefone com dígitos e DDD', async () => {
    await expect(db.exec(`insert into public.clientes (nome, telefone) values ('X', '(71) 9999')`)).rejects.toThrow(/check/)
  })
})

describe('modelo channel-agnostic (D3)', () => {
  it('registra qual hambúrguer foi escolhido dentro do combo e permite somar por produto real', async () => {
    const combo = '00000000-0000-4000-8001-000000000004'
    const smash = '00000000-0000-4000-8001-000000000001'
    await inserirPedido('tipo, subtotal_centavos, total_centavos', `'retirada', 3999, 3999`)
    const { rows: p } = await db.query<{ id: string }>(`select id from public.pedidos order by created_at desc limit 1`)
    const { rows: i } = await db.query<{ id: string }>(
      `insert into public.itens_pedido (pedido_id, produto_id, nome, quantidade, preco_unitario_centavos, total_centavos)
       values ('${p[0].id}', '${combo}', 'Combo Exemplo', 1, 3999, 3999) returning id`,
    )
    await db.exec(
      `insert into public.itens_pedido_componentes (item_pedido_id, produto_id, grupo_nome, opcao_nome)
       values ('${i[0].id}', '${smash}', 'Escolha seu hambúrguer', 'Smash Exemplo')`,
    )
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.itens_pedido_componentes where produto_id = '${smash}'`,
    )
    expect(rows[0].n).toBe(1)
  })

  it('não permite apagar um produto que já foi vendido', async () => {
    await expect(
      db.exec(`delete from public.produtos where id = '00000000-0000-4000-8001-000000000004'`),
    ).rejects.toThrow(/foreign key|violates/)
  })
})

describe('configuração da loja', () => {
  it('existe exatamente uma linha e não dá para criar outra', async () => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.configuracoes_loja`)
    expect(rows[0].n).toBe(1)
    await expect(db.exec(`insert into public.configuracoes_loja (id) values (2)`)).rejects.toThrow(/check/)
  })

  it('vem com funcionamento de quarta a domingo, 18h às 22h', async () => {
    const { rows } = await db.query<{ dia_semana: number; abre: string; fecha: string }>(
      `select dia_semana, abre::text, fecha::text from public.horarios_funcionamento order by dia_semana`,
    )
    expect(rows.map((r) => r.dia_semana)).toEqual([0, 3, 4, 5, 6])
    expect(rows.every((r) => r.abre.startsWith('18:00') && r.fecha.startsWith('22:00'))).toBe(true)
  })

  it('valida mín/máx de escolhas nos grupos de opção', async () => {
    await expect(
      db.exec(`insert into public.grupos_opcao (produto_id, nome, min_escolhas, max_escolhas)
        values ('00000000-0000-4000-8001-000000000001', 'Errado', 3, 1)`),
    ).rejects.toThrow(/check/)
  })
})

describe('preço "de/por" (tarefa 2.12)', () => {
  const categoria = '00000000-0000-4000-8000-000000000002'
  const inserir = (nome: string, preco: number, original: string) =>
    db.exec(`insert into public.produtos (categoria_id, nome, preco_centavos, preco_original_centavos)
      values ('${categoria}', '${nome}', ${preco}, ${original})`)

  it('aceita produto sem preço original e com preço original maior que o atual', async () => {
    await inserir('Sem desconto', 2000, 'null')
    await inserir('Com desconto', 2000, '2500')
  })

  it('recusa preço original igual ou menor que o atual (não seria desconto)', async () => {
    await expect(inserir('Igual', 2000, '2000')).rejects.toThrow(/check/)
    await expect(inserir('Menor', 2000, '1500')).rejects.toThrow(/check/)
  })

  it('o total do pedido nunca depende do preço original: ele não entra na conta do banco', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'pedidos' and column_name like '%original%'`,
    )
    expect(rows).toEqual([])
  })
})
