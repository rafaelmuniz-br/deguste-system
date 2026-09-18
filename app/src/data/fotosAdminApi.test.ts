import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { criarFotosAdminSupabase } from './fotosAdminApi.ts'

const AGORA = new Date(1_700_000_000_000)
const processado = {
  blob: new Blob(['x'], { type: 'image/webp' }),
  extensao: 'webp' as const,
  tipo: 'image/webp',
}
const arquivo = (extra: Partial<{ type: string; size: number }> = {}) =>
  ({ type: 'image/jpeg', size: 3_000_000, ...extra }) as unknown as File

function montar(
  opts: { upload?: unknown; updateErro?: { code?: string; message: string } | null } = {},
) {
  const remove = vi.fn().mockResolvedValue({ error: null })
  const upload = vi.fn().mockResolvedValue(opts.upload ?? { error: null })
  const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: opts.updateErro ?? null }) }))
  const cliente = {
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
        getPublicUrl: (p: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/fotos-produtos/${p}` },
        }),
      })),
    },
    from: vi.fn(() => ({ update })),
  } as unknown as SupabaseClient
  const processar = vi.fn().mockResolvedValue(processado)
  return {
    api: criarFotosAdminSupabase(cliente, processar, () => AGORA),
    upload,
    remove,
    update,
    processar,
    cliente,
  }
}

describe('fotos: enviar', () => {
  it('gera foto (1000 px) e miniatura (320 px), sobe as duas, grava o caminho e apaga a foto antiga com a miniatura dela', async () => {
    const t = montar()
    const r = await t.api.enviar('p1', arquivo(), 'p1/antiga.webp')
    expect(r).toEqual({ ok: true })
    expect(t.processar.mock.calls.map((c) => c[1])).toEqual([1000, 320])
    expect(t.upload).toHaveBeenCalledWith('p1/1700000000000.webp', processado.blob, {
      contentType: 'image/webp',
    })
    expect(t.upload).toHaveBeenCalledWith('p1/1700000000000-mini.webp', processado.blob, {
      contentType: 'image/webp',
    })
    expect(t.update).toHaveBeenCalledWith({ foto_path: 'p1/1700000000000.webp' })
    expect(t.remove).toHaveBeenCalledWith(['p1/antiga.webp', 'p1/antiga-mini.webp'])
  })

  it('falha ao subir a miniatura: apaga a foto já enviada e não mexe no produto', async () => {
    const t = montar()
    t.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'falhou' } })
    const r = await t.api.enviar('p1', arquivo(), 'p1/antiga.webp')
    expect(r.ok).toBe(false)
    expect(t.update).not.toHaveBeenCalled()
    expect(t.remove).toHaveBeenCalledTimes(1)
    expect(t.remove).toHaveBeenCalledWith(['p1/1700000000000.webp', 'p1/1700000000000-mini.webp'])
  })

  it('primeira foto: não tenta apagar nada', async () => {
    const t = montar()
    await t.api.enviar('p1', arquivo(), null)
    expect(t.remove).not.toHaveBeenCalled()
  })

  it('arquivo inválido: recusa ANTES de processar ou enviar', async () => {
    const t = montar()
    const r = await t.api.enviar('p1', arquivo({ type: 'application/pdf' }), null)
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('JPG, PNG ou WebP') })
    expect(t.processar).not.toHaveBeenCalled()
    expect(t.upload).not.toHaveBeenCalled()
  })

  it('imagem que o aparelho não consegue ler: mensagem clara, nada enviado', async () => {
    const t = montar()
    t.processar.mockRejectedValueOnce(new Error('decode'))
    const r = await t.api.enviar('p1', arquivo(), null)
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('Tente outra foto') })
    expect(t.upload).not.toHaveBeenCalled()
  })

  it('falha no upload: não mexe no produto nem apaga a foto antiga', async () => {
    const t = montar({ upload: { error: { message: 'too large' } } })
    const r = await t.api.enviar('p1', arquivo(), 'p1/antiga.webp')
    expect(r.ok).toBe(false)
    expect(t.update).not.toHaveBeenCalled()
    expect(t.remove).not.toHaveBeenCalled()
  })

  it('falha ao gravar no produto: apaga o arquivo recém-enviado (sem lixo) e mantém a foto antiga', async () => {
    const t = montar({ updateErro: { code: '42501', message: 'rls' } })
    const r = await t.api.enviar('p1', arquivo(), 'p1/antiga.webp')
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('Sem permissão') })
    expect(t.remove).toHaveBeenCalledTimes(1)
    expect(t.remove).toHaveBeenCalledWith(['p1/1700000000000.webp', 'p1/1700000000000-mini.webp'])
  })
})

describe('fotos: remover e url', () => {
  it('remover limpa o caminho no produto e apaga o arquivo', async () => {
    const t = montar()
    expect(await t.api.remover('p1', 'p1/a.webp')).toEqual({ ok: true })
    expect(t.update).toHaveBeenCalledWith({ foto_path: null })
    expect(t.remove).toHaveBeenCalledWith(['p1/a.webp', 'p1/a-mini.webp'])
  })

  it('remover com erro no banco mantém o arquivo', async () => {
    const t = montar({ updateErro: { message: 'x' } })
    expect((await t.api.remover('p1', 'p1/a.webp')).ok).toBe(false)
    expect(t.remove).not.toHaveBeenCalled()
  })

  it('urlMiniatura aponta para o arquivo -mini', () => {
    const t = montar()
    expect(t.api.urlMiniatura('p1/a.webp')).toMatch(/fotos-produtos\/p1\/a-mini\.webp$/)
  })

  it('urlPublica devolve o endereço do bucket público', () => {
    const t = montar()
    expect(t.api.urlPublica('p1/a.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/fotos-produtos/p1/a.webp',
    )
  })
})
