import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_FOTOS, caminhoDaFoto, validarArquivoFoto } from '../domain/fotos.ts'
import { redimensionarFoto, type FotoProcessada } from '../lib/imagem.ts'
import { resultado, type ResultadoSalvar } from './catalogoAdminApi.ts'

// Fotos dos produtos no Supabase Storage (bucket público `fotos-produtos`; só admin grava, ver migration
// 20260918200000). O arquivo é reduzido no navegador antes de subir.

export type ApiFotosAdmin = {
  /** Reduz, envia, grava o caminho no produto e apaga a foto antiga. */
  enviar(produtoId: string, arquivo: File, fotoAnterior: string | null): Promise<ResultadoSalvar>
  remover(produtoId: string, fotoAtual: string): Promise<ResultadoSalvar>
  /** Endereço público da foto (não faz consulta de rede). */
  urlPublica(fotoPath: string): string
}

export function criarFotosAdminSupabase(
  cliente: SupabaseClient,
  processar: (arquivo: Blob) => Promise<FotoProcessada> = redimensionarFoto,
  agora: () => Date = () => new Date(),
): ApiFotosAdmin {
  const bucket = () => cliente.storage.from(BUCKET_FOTOS)
  const apagarArquivo = (path: string) =>
    bucket()
      .remove([path])
      .catch(() => undefined)

  return {
    async enviar(produtoId, arquivo, fotoAnterior) {
      const invalido = validarArquivoFoto(arquivo)
      if (invalido) return { ok: false, mensagem: invalido }

      let foto: FotoProcessada
      try {
        foto = await processar(arquivo)
      } catch {
        return { ok: false, mensagem: 'Não foi possível ler essa imagem. Tente outra foto.' }
      }

      const path = caminhoDaFoto(produtoId, agora(), foto.extensao)
      const envio = await bucket().upload(path, foto.blob, { contentType: foto.tipo })
      if (envio.error) return resultado({ message: envio.error.message })

      const { error } = await cliente
        .from('produtos')
        .update({ foto_path: path })
        .eq('id', produtoId)
      if (error) {
        await apagarArquivo(path) // não deixa arquivo órfão ocupando espaço
        return resultado(error)
      }
      if (fotoAnterior) await apagarArquivo(fotoAnterior)
      return { ok: true }
    },

    async remover(produtoId, fotoAtual) {
      const { error } = await cliente
        .from('produtos')
        .update({ foto_path: null })
        .eq('id', produtoId)
      if (error) return resultado(error)
      await apagarArquivo(fotoAtual)
      return { ok: true }
    },

    urlPublica: (fotoPath) => bucket().getPublicUrl(fotoPath).data.publicUrl,
  }
}
