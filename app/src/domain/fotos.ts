// Regras das fotos dos produtos (tarefa 1.11). Puras e testadas; o redimensionamento em si
// (canvas do navegador) fica em lib/imagem.ts.

/** Bucket público do Supabase Storage (criado pela migration 20260918200000). */
export const BUCKET_FOTOS = 'fotos-produtos'

/** A foto é reduzida no navegador antes do envio: o lado maior nunca passa disto (economiza o free tier). */
export const LADO_MAXIMO_PX = 1000

/** Tamanho máximo do arquivo ESCOLHIDO (celulares tiram fotos de vários MB; depois reduzimos). */
export const LIMITE_ORIGINAL_BYTES = 15 * 1024 * 1024

export const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

export type ArquivoFoto = { type: string; size: number }

/** Devolve a mensagem de erro em português, ou null se o arquivo pode seguir. */
export function validarArquivoFoto(a: ArquivoFoto): string | null {
  if (!TIPOS_ACEITOS.includes(a.type)) {
    return 'Escolha uma foto nos formatos JPG, PNG ou WebP.'
  }
  if (a.size === 0) return 'O arquivo está vazio.'
  if (a.size > LIMITE_ORIGINAL_BYTES) {
    return 'A foto é muito grande (máximo 15 MB). Tente uma foto menor.'
  }
  return null
}

/** Reduz mantendo a proporção; nunca aumenta uma foto que já é pequena. */
export function calcularTamanho(
  largura: number,
  altura: number,
  maximo = LADO_MAXIMO_PX,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= maximo) return { largura, altura }
  const fator = maximo / maior
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  }
}

/**
 * Caminho no bucket: uma pasta por produto e um nome novo a cada envio. Nome novo evita que o
 * navegador (e o cache do Supabase) continue mostrando a foto antiga depois de trocar.
 */
export function caminhoDaFoto(produtoId: string, agora: Date, extensao: 'webp' | 'jpg'): string {
  return `${produtoId}/${agora.getTime()}.${extensao}`
}
