import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { admin, anon, clienteLogado, como, criarBanco } from './helpers.ts'

let db: PGlite

beforeAll(async () => {
  db = await criarBanco()
  await db.exec(`
    insert into storage.buckets (id, name) values ('outro-bucket', 'outro-bucket');
    insert into storage.objects (bucket_id, name) values ('fotos-produtos', 'p1/existente.webp');
    insert into storage.objects (bucket_id, name) values ('outro-bucket', 'segredo.txt');
  `)
}, 60_000)

afterAll(async () => {
  await db.close()
})

const inserir = (papel: typeof admin, bucket = 'fotos-produtos', nome = 'p1/nova.webp') =>
  como(db, papel, () =>
    db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, nome]),
  )

describe('fotos dos produtos: bucket (1.11)', () => {
  it('o bucket é público, com limite de 1 MB e só WebP/JPEG', async () => {
    const { rows } = await db.query<{
      public: boolean
      file_size_limit: string
      allowed_mime_types: string[]
    }>(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'fotos-produtos'`)
    expect(rows).toHaveLength(1)
    expect(rows[0].public).toBe(true)
    expect(Number(rows[0].file_size_limit)).toBe(1048576)
    expect(rows[0].allowed_mime_types).toEqual(['image/webp', 'image/jpeg'])
  })
})

describe('fotos dos produtos: quem lê e quem escreve', () => {
  it('qualquer pessoa (anônima) enxerga as fotos, mas só as deste bucket', async () => {
    const { rows } = await como(db, anon, () => db.query<{ name: string }>(`select name from storage.objects`))
    expect(rows.map((r) => r.name)).toEqual(['p1/existente.webp'])
  })

  it('admin envia, troca e apaga fotos', async () => {
    await inserir(admin, 'fotos-produtos', 'p1/admin.webp')
    await como(db, admin, () =>
      db.query(`update storage.objects set name = 'p1/admin2.webp' where name = 'p1/admin.webp'`),
    )
    const { rows } = await como(db, admin, () =>
      db.query(`delete from storage.objects where name = 'p1/admin2.webp' returning name`),
    )
    expect(rows).toHaveLength(1)
  })

  it('anônimo NÃO envia foto', async () => {
    await expect(inserir(anon)).rejects.toThrow()
  })

  it('usuário logado que não é admin NÃO envia nem apaga foto', async () => {
    await expect(inserir(clienteLogado)).rejects.toThrow()
    const { rows } = await como(db, clienteLogado, () =>
      db.query(`delete from storage.objects where name = 'p1/existente.webp' returning name`),
    )
    expect(rows).toHaveLength(0)
    const { rows: ainda } = await como(db, anon, () =>
      db.query(`select name from storage.objects where name = 'p1/existente.webp'`),
    )
    expect(ainda).toHaveLength(1)
  })

  it('nem admin grava em OUTRO bucket por estas políticas (elas valem só para as fotos)', async () => {
    await expect(inserir(admin, 'outro-bucket', 'x.txt')).rejects.toThrow()
  })

  it('anônimo não consegue alterar foto existente', async () => {
    const { rows } = await como(db, anon, () =>
      db.query(`update storage.objects set name = 'hack' where name = 'p1/existente.webp' returning name`),
    )
    expect(rows).toHaveLength(0)
  })
})
