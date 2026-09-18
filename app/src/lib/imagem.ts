import { calcularTamanho } from '../domain/fotos.ts'

export type FotoProcessada = { blob: Blob; extensao: 'webp' | 'jpg'; tipo: string }

/**
 * Reduz a foto no navegador (lado maior 1000 px) e comprime em WebP (ou JPEG, se o aparelho não gerar
 * WebP). Uma foto de celular de 5 MB vira ~100 KB: cabe folgado no free tier do Supabase e carrega
 * rápido para o cliente. Usa canvas, então só roda no navegador (os testes injetam um processador falso).
 */
export async function redimensionarFoto(arquivo: Blob): Promise<FotoProcessada> {
  // `imageOrientation: 'from-image'` respeita a rotação gravada pelo celular (senão a foto sai deitada).
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  try {
    const { largura, altura } = calcularTamanho(imagem.width, imagem.height)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Este aparelho não conseguiu processar a imagem.')
    // Fundo branco: PNG com transparência viraria preto ao comprimir em JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(imagem, 0, 0, largura, altura)

    const gerar = (tipo: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, 0.82))
    const webp = await gerar('image/webp')
    if (webp && webp.type === 'image/webp')
      return { blob: webp, extensao: 'webp', tipo: 'image/webp' }
    const jpeg = await gerar('image/jpeg')
    if (!jpeg) throw new Error('Este aparelho não conseguiu comprimir a imagem.')
    return { blob: jpeg, extensao: 'jpg', tipo: 'image/jpeg' }
  } finally {
    imagem.close()
  }
}
