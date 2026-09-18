import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anon, clienteLogado, como, criarBanco, servico } from './helpers.ts'

// Testa o pagamento por Pix do lado do BANCO (3.8, 3.9, 3.14): confirmação idempotente, trava de valor,
// pagamento depois do cancelamento, expiração e permissões. Independe do gateway escolhido.

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
}, 60_000)

afterAll(async () => {
  await db.close()
})

let seq = 0

/** Pedido "aguardando pagamento" (o mesmo estado em que criar_pedido o deixa). */
async function novoPedido(o: { total?: number; minutosAtras?: number; telefone?: string } = {}) {
  seq++
  const total = o.total ?? 3000
  const { rows } = await db.query<{ id: string; token_acompanhamento: string }>(
    `insert into public.pedidos
       (cliente_nome, cliente_telefone, tipo, status, pagamento_status, subtotal_centavos, total_centavos, created_at)
     values ('Cliente', $1, 'retirada', 'aguardando_pagamento', 'pendente', $2, $2, now() - make_interval(mins => $3))
     returning id, token_acompanhamento`,
    [o.telefone ?? `7199999${String(1000 + seq)}`, total, o.minutosAtras ?? 0],
  )
  return rows[0]
}

const registrar = (id: string, externo: string, copia = '000201...', expira = "now() + interval '30 minutes'") =>
  como(db, servico, async () =>
    (
      await db.query<{ r: string }>(
        `select public.registrar_cobranca_pix($1, $2, $3, ${expira}) as r`,
        [id, externo, copia],
      )
    ).rows[0].r,
  )

const confirmar = (externo: string, valor: number | null) =>
  como(db, servico, async () =>
    (await db.query<{ r: string }>(`select public.confirmar_pagamento_pix($1, $2) as r`, [externo, valor])).rows[0].r,
  )

const pedido = async (id: string) =>
  (
    await db.query<{
      status: string
      pagamento_status: string
      pagamento_metodo: string | null
      pago_em: string | null
      pix_copia_cola: string | null
    }>(`select status, pagamento_status, pagamento_metodo, pago_em, pix_copia_cola from public.pedidos where id = $1`, [id])
  ).rows[0]

const naFila = async (id: string) =>
  (await db.query(`select 1 from public.impressoes where pedido_id = $1`, [id])).rows.length

const paraRevisar = async (id: string) =>
  (
    await db.query<{ motivo: string; valor_recebido_centavos: number }>(
      `select motivo, valor_recebido_centavos from public.pagamentos_para_revisar where pedido_id = $1 order by motivo`,
      [id],
    )
  ).rows

describe('registrar_cobranca_pix', () => {
  it('guarda o Pix no pedido', async () => {
    const p = await novoPedido()
    expect(await registrar(p.id, 'mp-1', 'CODIGO-PIX')).toBe('registrada')
    expect(await pedido(p.id)).toMatchObject({ pagamento_metodo: 'pix', pix_copia_cola: 'CODIGO-PIX', pagamento_status: 'pendente' })
  })

  it('repetir com a mesma cobrança é seguro; outra cobrança para o mesmo pedido é recusada', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-2')
    expect(await registrar(p.id, 'mp-2')).toBe('ja_registrada')
    expect(await registrar(p.id, 'mp-2-OUTRA')).toBe('outra_cobranca_existente')
  })

  it('não gera Pix para pedido que não aguarda pagamento, nem para pedido que não existe', async () => {
    const p = await novoPedido()
    await db.query(`update public.pedidos set status = 'cancelado', motivo_cancelamento = 'x' where id = $1`, [p.id])
    expect(await registrar(p.id, 'mp-3')).toBe('pedido_nao_aguarda_pagamento')
    expect(await registrar('00000000-0000-4000-8000-00000000dead', 'mp-4')).toBe('pedido_inexistente')
  })
})

describe('confirmar_pagamento_pix (3.9)', () => {
  it('confirma: pedido vira pago e novo, e entra na fila de impressão', async () => {
    const p = await novoPedido({ total: 4500 })
    await registrar(p.id, 'mp-10')
    expect(await confirmar('mp-10', 4500)).toBe('confirmado')
    const r = await pedido(p.id)
    expect(r).toMatchObject({ status: 'novo', pagamento_status: 'pago' })
    expect(r.pago_em).not.toBeNull()
    expect(await naFila(p.id)).toBe(1)
  })

  it('IDEMPOTENTE: aviso repetido não muda nada (data, status, fila)', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-11')
    await confirmar('mp-11', 3000)
    const antes = await pedido(p.id)
    // a cozinha já andou com o pedido
    await db.query(`update public.pedidos set status = 'em_preparo' where id = $1`, [p.id])

    expect(await confirmar('mp-11', 3000)).toBe('ja_confirmado')
    expect(await confirmar('mp-11', 3000)).toBe('ja_confirmado')

    const depois = await pedido(p.id)
    expect(depois.pago_em).toStrictEqual(antes.pago_em) // não reescreveu a data do pagamento
    expect(depois.status).toBe('em_preparo') // não "voltou" o pedido para novo
    expect(await naFila(p.id)).toBe(1) // uma impressão só
    expect(await paraRevisar(p.id)).toEqual([])
  })

  it('TRAVA DE VALOR: valor diferente do total não confirma e vai para revisão (menor ou maior)', async () => {
    const menor = await novoPedido({ total: 3000 })
    await registrar(menor.id, 'mp-12')
    expect(await confirmar('mp-12', 2999)).toBe('valor_divergente')
    expect(await pedido(menor.id)).toMatchObject({ status: 'aguardando_pagamento', pagamento_status: 'pendente' })
    expect(await paraRevisar(menor.id)).toEqual([{ motivo: 'valor_divergente', valor_recebido_centavos: 2999 }])
    expect(await naFila(menor.id)).toBe(0)

    const maior = await novoPedido({ total: 3000 })
    await registrar(maior.id, 'mp-13')
    expect(await confirmar('mp-13', 3001)).toBe('valor_divergente')
    expect(await confirmar('mp-13', null)).toBe('valor_divergente')
    expect(await pedido(maior.id).then((x) => x.pagamento_status)).toBe('pendente')
  })

  it('valor divergente repetido não duplica a linha de revisão', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-14')
    await confirmar('mp-14', 100)
    await confirmar('mp-14', 100)
    expect(await paraRevisar(p.id)).toHaveLength(1)
  })

  it('pagamento com o valor certo depois de uma tentativa divergente ainda confirma', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-15')
    await confirmar('mp-15', 100)
    expect(await confirmar('mp-15', 3000)).toBe('confirmado')
  })

  it('cobrança desconhecida: não muda nada', async () => {
    expect(await confirmar('nao-existe', 3000)).toBe('desconhecido')
  })

  it('PAGAMENTO APÓS CANCELAMENTO: dinheiro entra, pedido NÃO vai para a cozinha nem para a impressora, e fica para estorno', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-16')
    await db.query(`update public.pedidos set status = 'cancelado', motivo_cancelamento = 'cliente desistiu' where id = $1`, [p.id])

    expect(await confirmar('mp-16', 3000)).toBe('pago_apos_cancelamento')

    expect(await pedido(p.id)).toMatchObject({ status: 'cancelado', pagamento_status: 'pago' })
    expect(await naFila(p.id)).toBe(0)
    expect(await paraRevisar(p.id)).toEqual([{ motivo: 'pago_apos_cancelamento', valor_recebido_centavos: 3000 }])
    // aviso repetido continua sem duplicar
    expect(await confirmar('mp-16', 3000)).toBe('ja_confirmado')
    expect(await paraRevisar(p.id)).toHaveLength(1)
  })

  it('PAGAMENTO APÓS EXPIRAÇÃO (o caso de verdade): expira sozinho, depois o Pix cai e vai para estorno', async () => {
    const p = await novoPedido({ minutosAtras: 45 })
    await registrar(p.id, 'mp-17', 'X', "now() - interval '15 minutes'") // Pix venceu há 15 min
    await como(db, servico, () => db.query(`select public.expirar_pedidos_pendentes(30)`))
    expect(await pedido(p.id)).toMatchObject({ status: 'cancelado', pagamento_status: 'expirado' })

    expect(await confirmar('mp-17', 3000)).toBe('pago_apos_cancelamento')
    expect(await naFila(p.id)).toBe(0)
    expect((await paraRevisar(p.id))[0].motivo).toBe('pago_apos_cancelamento')
  })
})

describe('expirar_pedidos_pendentes', () => {
  const expirar = (min = 30) =>
    como(db, servico, async () => (await db.query<{ n: number }>(`select public.expirar_pedidos_pendentes($1) as n`, [min])).rows[0].n)

  it('cancela só o que está pendente e passou do prazo (Pix vencido + 2 min de folga)', async () => {
    const vencido = await novoPedido()
    await registrar(vencido.id, 'mp-20', 'X', "now() - interval '5 minutes'")
    const naFolga = await novoPedido()
    await registrar(naFolga.id, 'mp-21', 'X', "now() - interval '1 minute'") // dentro dos 2 min de folga
    const valido = await novoPedido()
    await registrar(valido.id, 'mp-22', 'X', "now() + interval '20 minutes'")

    await expirar()

    expect((await pedido(vencido.id)).status).toBe('cancelado')
    expect(await db.query(`select motivo_cancelamento from public.pedidos where id = $1`, [vencido.id]).then((r) => r.rows[0])).toEqual({
      motivo_cancelamento: 'Pagamento não realizado a tempo',
    })
    expect((await pedido(naFolga.id)).status).toBe('aguardando_pagamento')
    expect((await pedido(valido.id)).status).toBe('aguardando_pagamento')
  })

  it('Pix ainda não gerado: vale o prazo desde a criação do pedido', async () => {
    const velho = await novoPedido({ minutosAtras: 40 })
    const novo = await novoPedido({ minutosAtras: 5 })
    await expirar(30)
    expect((await pedido(velho.id)).pagamento_status).toBe('expirado')
    expect((await pedido(novo.id)).pagamento_status).toBe('pendente')
  })

  it('não mexe em pedido já pago, nem em pedido que a cozinha já está fazendo', async () => {
    const pago = await novoPedido({ minutosAtras: 90 })
    await registrar(pago.id, 'mp-23')
    await confirmar('mp-23', 3000)
    await expirar(30)
    expect(await pedido(pago.id)).toMatchObject({ status: 'novo', pagamento_status: 'pago' })
  })

  it('devolve quantos cancelou e é seguro repetir', async () => {
    await novoPedido({ minutosAtras: 100 })
    const primeira = await expirar(30)
    expect(primeira).toBeGreaterThanOrEqual(1)
    expect(await expirar(30)).toBe(0)
  })

  it('libera o limite anti-spam do telefone (pedido expirado deixa de contar como pendente)', async () => {
    const tel = '71988887777'
    for (let i = 0; i < 3; i++) await novoPedido({ telefone: tel, minutosAtras: 40 })
    await expirar(30)
    const { rows } = await db.query<{ n: string }>(
      `select count(*) n from public.pedidos where cliente_telefone = $1 and status = 'aguardando_pagamento' and pagamento_status = 'pendente'`,
      [tel],
    )
    expect(Number(rows[0].n)).toBe(0)
  })
})

describe('acompanhar_pedido com Pix', () => {
  const acompanhar = (token: string) =>
    como(db, anon, async () =>
      (
        await db.query<{ status: string; pix_copia_cola: string | null; pagamento_expira_em: string | null }>(
          `select status, pix_copia_cola, pagamento_expira_em from public.acompanhar_pedido($1)`,
          [token],
        )
      ).rows[0],
    )

  it('devolve o Pix e o prazo enquanto dá para pagar; depois de pago, o código some', async () => {
    const p = await novoPedido()
    await registrar(p.id, 'mp-30', 'CODIGO-SECRETO')
    const antes = await acompanhar(p.token_acompanhamento)
    expect(antes.pix_copia_cola).toBe('CODIGO-SECRETO')
    expect(antes.pagamento_expira_em).not.toBeNull()

    await confirmar('mp-30', 3000)
    const depois = await acompanhar(p.token_acompanhamento)
    expect(depois.pix_copia_cola).toBeNull()
    expect(depois.status).toBe('novo')
  })

  it('pedido sem Pix gerado ainda: código nulo', async () => {
    const p = await novoPedido()
    expect((await acompanhar(p.token_acompanhamento)).pix_copia_cola).toBeNull()
  })

  it('token errado não devolve nada', async () => {
    expect(await acompanhar('00000000-0000-4000-8000-00000000dead')).toBeUndefined()
  })
})

describe('permissões', () => {
  it('ninguém além do servidor chama as funções de pagamento (anônimo, cliente logado e até admin)', async () => {
    const p = await novoPedido()
    for (const papel of [anon, clienteLogado, admin]) {
      await expect(
        como(db, papel, () => db.query(`select public.confirmar_pagamento_pix('x', 1)`)),
      ).rejects.toThrow()
      await expect(
        como(db, papel, () => db.query(`select public.registrar_cobranca_pix($1, 'x', 'y', now())`, [p.id])),
      ).rejects.toThrow()
      await expect(
        como(db, papel, () => db.query(`select public.expirar_pedidos_pendentes(1)`)),
      ).rejects.toThrow()
    }
  })

  it('a lista de pagamentos para revisar é só do admin', async () => {
    const vistoPeloAnon = await como(db, anon, async () => (await db.query(`select * from public.pagamentos_para_revisar`)).rows.length)
    const vistoPeloLogado = await como(db, clienteLogado, async () => (await db.query(`select * from public.pagamentos_para_revisar`)).rows.length)
    const vistoPeloAdmin = await como(db, admin, async () => (await db.query(`select * from public.pagamentos_para_revisar`)).rows.length)
    expect(vistoPeloAnon).toBe(0)
    expect(vistoPeloLogado).toBe(0)
    expect(vistoPeloAdmin).toBeGreaterThan(0)
  })
})
