// Pix na página do pedido: pede ao servidor (function `gerar-pix`) o código "copia e cola" do pedido.
// O navegador manda só o TOKEN do pedido; o valor sai do banco (nunca do navegador). Ver docs/pagamento.md.

export type RespostaPix =
  | { ok: true; copiaCola: string; expiraEm?: string }
  | { ok: false; motivo: 'expirado' | 'nao_aguarda_pagamento' | 'indisponivel' }

export type ApiPix = { gerar(token: string): Promise<RespostaPix> }

export function criarPixHttp(endpoint = '/.netlify/functions/gerar-pix'): ApiPix {
  return {
    async gerar(token) {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const corpo = (await r.json().catch(() => ({}))) as {
          copiaCola?: unknown
          expiraEm?: unknown
          erro?: unknown
        }
        if (r.ok && typeof corpo.copiaCola === 'string' && corpo.copiaCola.length > 0) {
          return {
            ok: true,
            copiaCola: corpo.copiaCola,
            expiraEm: typeof corpo.expiraEm === 'string' ? corpo.expiraEm : undefined,
          }
        }
        if (r.status === 409) {
          return {
            ok: false,
            motivo: corpo.erro === 'pix_expirado' ? 'expirado' : 'nao_aguarda_pagamento',
          }
        }
        return { ok: false, motivo: 'indisponivel' }
      } catch {
        return { ok: false, motivo: 'indisponivel' }
      }
    },
  }
}

/** SÓ DESENVOLVIMENTO: devolve um código de mentira (não paga nada). */
export function criarPixSimulado(agora: () => Date = () => new Date()): ApiPix {
  return {
    async gerar() {
      return {
        ok: true,
        copiaCola:
          '00020126580014br.gov.bcb.pix0136SIMULADO-NAO-PAGAR-ESTE-CODIGO-DE-TESTE5204000053039865802BR5913DEGUSTE TESTE6008SALVADOR62070503***6304ABCD',
        expiraEm: new Date(agora().getTime() + 30 * 60_000).toISOString(),
      }
    },
  }
}
