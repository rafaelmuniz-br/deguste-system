import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiPix, RespostaPix } from '../data/pixApi.ts'
import PagamentoPix from './PagamentoPix.tsx'

const CODIGO =
  '00020126580014br.gov.bcb.pix0136abc520400005303986540510.005802BR5913DEGUSTE6008SALVADOR62070503***6304ABCD'
const AGORA = new Date('2026-09-18T20:00:00Z')
const EM_20_MIN = '2026-09-18T20:20:00Z'

function montar(
  o: {
    inicial?: string
    expiraEm?: string
    resposta?: RespostaPix
    aoConferir?: () => Promise<void>
    agora?: () => Date
  } = {},
) {
  const gerar = vi.fn(
    async () => o.resposta ?? ({ ok: true, copiaCola: CODIGO, expiraEm: EM_20_MIN } as RespostaPix),
  )
  const api: ApiPix = { gerar }
  const aoConferir = o.aoConferir ?? vi.fn(async () => {})
  render(
    <MemoryRouter>
      <PagamentoPix
        token="tok-1"
        copiaColaInicial={o.inicial}
        expiraEmInicial={o.expiraEm}
        api={api}
        aoConferir={aoConferir}
        agora={o.agora ?? (() => AGORA)}
      />
    </MemoryRouter>,
  )
  return { gerar, aoConferir }
}

describe('PagamentoPix', () => {
  it('sem Pix ainda: pede ao servidor com o token e mostra QR, código e prazo', async () => {
    const { gerar } = montar()
    expect(screen.getByText('Gerando o seu Pix…')).toBeInTheDocument()

    expect(await screen.findByRole('img', { name: /QR Code/ })).toBeInTheDocument()
    expect(gerar).toHaveBeenCalledWith('tok-1')
    expect(screen.getByLabelText('Pix Copia e Cola')).toHaveValue(CODIGO)
    expect(screen.getByText('20 min')).toBeInTheDocument()
  })

  it('o QR é desenhado com fundo branco e módulos pretos (legível no modo escuro também)', async () => {
    montar()
    const qr = await screen.findByRole('img', { name: /QR Code/ })
    expect(qr.querySelector('rect')).toHaveAttribute('fill', '#ffffff')
    const path = qr.querySelector('path')!
    expect(path).toHaveAttribute('fill', '#000000')
    expect(path.getAttribute('d')!.length).toBeGreaterThan(100)
    expect(qr.getAttribute('viewBox')).toMatch(/^-4 -4 /) // margem de 4 módulos
  })

  it('Pix que o acompanhamento já trouxe: mostra na hora, sem pedir outro ao servidor', () => {
    const { gerar } = montar({ inicial: CODIGO, expiraEm: EM_20_MIN })
    expect(screen.getByRole('img', { name: /QR Code/ })).toBeInTheDocument()
    expect(gerar).not.toHaveBeenCalled()
  })

  it('copiar: usa a área de transferência e confirma', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escrever },
      configurable: true,
    })
    montar({ inicial: CODIGO, expiraEm: EM_20_MIN })
    await user.click(screen.getByRole('button', { name: 'Copiar código' }))
    expect(escrever).toHaveBeenCalledWith(CODIGO)
    expect(await screen.findByText(/Código copiado/)).toBeInTheDocument()
  })

  it('sem permissão para copiar: seleciona o código e explica o que fazer', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('negado')) },
      configurable: true,
    })
    montar({ inicial: CODIGO, expiraEm: EM_20_MIN })
    await user.click(screen.getByRole('button', { name: 'Copiar código' }))
    expect(await screen.findByText(/Não deu para copiar sozinho/)).toBeInTheDocument()
  })

  it('"Já paguei" pede uma consulta agora e explica que a página atualiza sozinha', async () => {
    const user = userEvent.setup()
    const { aoConferir } = montar({ inicial: CODIGO, expiraEm: EM_20_MIN })
    await user.click(screen.getByRole('button', { name: 'Já paguei' }))
    expect(aoConferir).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Ainda não recebemos a confirmação/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Já paguei' })).toBeEnabled()
  })

  it('servidor fora do ar: avisa que nada foi cobrado e deixa tentar de novo', async () => {
    const user = userEvent.setup()
    const { gerar } = montar({ resposta: { ok: false, motivo: 'indisponivel' } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/nada foi cobrado/)
    expect(screen.queryByRole('img', { name: /QR Code/ })).not.toBeInTheDocument()

    gerar.mockResolvedValueOnce({ ok: true, copiaCola: CODIGO, expiraEm: EM_20_MIN })
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('img', { name: /QR Code/ })).toBeInTheDocument()
    expect(gerar).toHaveBeenCalledTimes(2)
  })

  it('Pix vencido (resposta do servidor): manda NÃO pagar e oferece novo pedido, sem QR', async () => {
    montar({ resposta: { ok: false, motivo: 'expirado' } })
    expect(await screen.findByText('O prazo para pagar acabou')).toBeInTheDocument()
    expect(screen.getByText(/Não pague este código/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer um novo pedido' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('img', { name: /QR Code/ })).not.toBeInTheDocument()
  })

  describe('contagem do prazo', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('o "faltam X min" acompanha o relógio e, ao chegar a zero, o QR sai de cena', async () => {
      let agora = AGORA
      montar({ inicial: CODIGO, expiraEm: EM_20_MIN, agora: () => agora })
      expect(screen.getByText('20 min')).toBeInTheDocument()

      agora = new Date('2026-09-18T20:10:00Z')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(screen.getByText('10 min')).toBeInTheDocument()

      agora = new Date('2026-09-18T20:20:01Z')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(screen.getByText('O prazo para pagar acabou')).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: /QR Code/ })).not.toBeInTheDocument()
    })
  })

  it('acessibilidade (axe): com QR e no aviso de prazo vencido', async () => {
    const opcoes = {
      runOnly: {
        type: 'tag' as const,
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    }
    montar({ inicial: CODIGO, expiraEm: EM_20_MIN })
    const r = await axe.run(document.body, opcoes)
    expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
