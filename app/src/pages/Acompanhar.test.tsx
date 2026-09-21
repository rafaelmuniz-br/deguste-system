import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import type {
  ApiAcompanhamento,
  PedidoAcompanhado,
  RespostaAcompanhamento,
} from '../data/acompanhamentoApi.ts'
import { cardapioExemplo } from '../data/exemplo.ts'
import type { ApiPedidos } from '../data/pedidosApi.ts'
import type { ApiPix } from '../data/pixApi.ts'
import { ContextoLoja } from '../state/contextoLoja.ts'
import Acompanhar from './Acompanhar.tsx'

const pedido = (over: Partial<PedidoAcompanhado> = {}): PedidoAcompanhado => ({
  numero: 7,
  tipo: 'entrega',
  status: 'aguardando_pagamento',
  pagamentoStatus: 'pendente',
  totalCentavos: 3579,
  criadoEm: '2026-09-18T20:00:00Z',
  ...over,
})
const ok = (over: Partial<PedidoAcompanhado> = {}): RespostaAcompanhamento => ({
  ok: true,
  pedido: pedido(over),
})

const pixIndisponivel: ApiPix = { gerar: async () => ({ ok: false, motivo: 'indisponivel' }) }

/** Renderiza a página com um acompanhamento controlado pelo teste. */
function abrir(respostas: RespostaAcompanhamento[], pix: ApiPix = pixIndisponivel) {
  const buscar = vi.fn(
    async () => respostas[Math.min(buscar.mock.calls.length - 1, respostas.length - 1)],
  )
  const acompanhamento: ApiAcompanhamento = { buscar }
  const api = {} as ApiPedidos
  render(
    <ContextoLoja.Provider
      value={{
        cardapio: cardapioExemplo,
        ehExemplo: false,
        apiSimulada: false,
        api,
        acompanhamento,
        pix,
      }}
    >
      <MemoryRouter initialEntries={['/acompanhar/tok-1']}>
        <Routes>
          <Route path="/acompanhar/:token" element={<Acompanhar />} />
        </Routes>
      </MemoryRouter>
    </ContextoLoja.Provider>,
  )
  return buscar
}

const avancar = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
})

describe('página de acompanhamento', () => {
  it('mostra número, mensagem e o passo atual da linha do tempo', async () => {
    abrir([ok({ status: 'em_preparo', pagamentoStatus: 'pago' })])
    expect(await screen.findByRole('heading', { name: 'Pedido nº 7' })).toBeInTheDocument()
    expect(screen.getByText('Seu pedido está sendo preparado.')).toBeInTheDocument()
    const passos = screen.getAllByRole('listitem')
    expect(passos.find((li) => li.getAttribute('aria-current') === 'step')).toHaveTextContent(
      'Em preparo',
    )
    expect(passos[0]).toHaveTextContent('Concluído: Aguardando pagamento')
  })

  it('mostra a previsão de preparo enquanto não está pronto (e a entrega é mencionada)', async () => {
    abrir([ok({ status: 'em_preparo', pagamentoStatus: 'pago' })])
    expect(await screen.findByText(/Preparo em cerca de/)).toHaveTextContent(
      'Preparo em cerca de 30 min depois do pagamento confirmado, mais o tempo da entrega.',
    )
  })

  it('retirada não menciona entrega; pedido pronto ou concluído não mostra mais a previsão', async () => {
    abrir([ok({ tipo: 'retirada', status: 'novo', pagamentoStatus: 'pago' })])
    expect(await screen.findByText(/Preparo em cerca de/)).not.toHaveTextContent(/entrega/)
  })

  it('pedido pronto: sem previsão de preparo', async () => {
    abrir([ok({ status: 'pronto', pagamentoStatus: 'pago' })])
    await screen.findByRole('heading', { name: 'Pedido nº 7' })
    expect(screen.queryByText(/Preparo em cerca de/)).not.toBeInTheDocument()
  })

  it('atualiza sozinho a cada 10 s e para de consultar quando o pedido termina', async () => {
    const buscar = abrir([
      ok(),
      ok({ status: 'em_preparo', pagamentoStatus: 'pago' }),
      ok({ status: 'concluido', pagamentoStatus: 'pago' }),
    ])
    expect(
      await screen.findByText('Aguardando a confirmação do seu pagamento.'),
    ).toBeInTheDocument()
    await avancar(10_000)
    expect(await screen.findByText('Seu pedido está sendo preparado.')).toBeInTheDocument()
    await avancar(10_000)
    expect(await screen.findByText('Pedido entregue. Bom apetite!')).toBeInTheDocument()

    const chamadas = buscar.mock.calls.length
    await avancar(60_000) // terminal: não consulta mais
    expect(buscar.mock.calls.length).toBe(chamadas)
  })

  it('falha passageira não apaga o último status que a pessoa já estava vendo', async () => {
    abrir([
      ok({ status: 'em_preparo', pagamentoStatus: 'pago' }),
      { ok: false, motivo: 'indisponivel' },
    ])
    expect(await screen.findByText('Seu pedido está sendo preparado.')).toBeInTheDocument()
    await avancar(10_000)
    expect(screen.getByText('Seu pedido está sendo preparado.')).toBeInTheDocument()
    expect(screen.queryByText(/Não conseguimos consultar/)).not.toBeInTheDocument()
  })

  it('sem nenhum status anterior, falha mostra aviso sem alarmar ("seu pedido não foi afetado")', async () => {
    abrir([{ ok: false, motivo: 'indisponivel' }])
    expect(await screen.findByRole('alert')).toHaveTextContent('Seu pedido não foi afetado')
  })

  it('token que não existe: mensagem clara e para de consultar', async () => {
    const buscar = abrir([{ ok: false, motivo: 'nao_encontrado' }])
    expect(
      await screen.findByRole('heading', { name: 'Pedido não encontrado' }),
    ).toBeInTheDocument()
    const chamadas = buscar.mock.calls.length
    await avancar(30_000)
    expect(buscar.mock.calls.length).toBe(chamadas)
  })

  it('cancelado: alerta e sem linha do tempo', async () => {
    abrir([ok({ status: 'cancelado', pagamentoStatus: 'estornado' })])
    expect(await screen.findByText(/Este pedido foi cancelado/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Andamento do pedido' })).not.toBeInTheDocument()
  })

  it('Pix expirado: diz que nada foi cobrado', async () => {
    abrir([ok({ pagamentoStatus: 'expirado' })])
    expect(await screen.findByText(/nada foi cobrado/)).toBeInTheDocument()
  })

  it('retirada usa os passos de retirada', async () => {
    abrir([ok({ tipo: 'retirada', status: 'pronto', pagamentoStatus: 'pago' })])
    expect(await screen.findByText('Seu pedido está pronto para retirada!')).toBeInTheDocument()
    expect(screen.queryByText('Saiu para entrega')).not.toBeInTheDocument()
    expect(screen.getByText('Pronto para retirar')).toBeInTheDocument()
  })

  it('aba em segundo plano: consulta uma vez ao abrir e depois pausa; ao voltar, atualiza na hora', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    const buscar = abrir([ok(), ok({ status: 'em_preparo', pagamentoStatus: 'pago' })])
    expect(
      await screen.findByText('Aguardando a confirmação do seu pagamento.'),
    ).toBeInTheDocument()
    expect(buscar).toHaveBeenCalledTimes(1) // a 1ª consulta acontece mesmo com a aba oculta

    await avancar(35_000) // oculta: não gasta requisição
    expect(buscar).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(await screen.findByText('Seu pedido está sendo preparado.')).toBeInTheDocument()
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('mostra o total do pedido', async () => {
    abrir([ok()])
    expect(await screen.findByText(/R\$\s*35,79/)).toBeInTheDocument()
  })
})

describe('jornada completa (modo simulado)', () => {
  it('a página pelo endereço /acompanhar/<token> acha o pedido registrado pelo checkout simulado', async () => {
    vi.useRealTimers()
    const token = '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f'
    localStorage.setItem(
      'deguste:dev-pedidos',
      JSON.stringify({
        [token]: {
          numero: 55,
          tipo: 'retirada',
          totalCentavos: 800,
          criadoEm: Date.now() - 20_000,
        },
      }),
    )
    render(
      <MemoryRouter initialEntries={[`/acompanhar/${token}`]}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Pedido nº 55' })).toBeInTheDocument()
    expect(screen.getByText(/Pedido de TESTE/)).toBeInTheDocument()
    expect(screen.getByText(/Pagamento confirmado/)).toBeInTheDocument()
    localStorage.clear()
  })
})

describe('pagamento por Pix na página do pedido', () => {
  const CODIGO =
    '00020126580014br.gov.bcb.pix0136xyz5204000053039865802BR5913DEGUSTE6008SALVADOR62070503***6304ABCD'
  const pixOk = (): ApiPix & { gerar: ReturnType<typeof vi.fn> } => ({
    gerar: vi.fn(async () => ({
      ok: true as const,
      copiaCola: CODIGO,
      expiraEm: '2099-01-01T00:00:00Z',
    })),
  })

  it('aguardando pagamento: pede o Pix com o token da página e mostra QR e código', async () => {
    const pix = pixOk()
    abrir([ok()], pix)
    expect(await screen.findByRole('heading', { name: 'Pague com Pix' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /QR Code/ })).toBeInTheDocument()
    expect(pix.gerar).toHaveBeenCalledWith('tok-1')
    expect(screen.getByLabelText('Pix Copia e Cola')).toHaveValue(CODIGO)
  })

  it('o Pix que o banco já devolveu no acompanhamento é usado direto (sem gerar outro)', async () => {
    const pix = pixOk()
    abrir(
      [ok({ pixCopiaCola: 'CODIGO-JA-GERADO', pagamentoExpiraEm: '2099-01-01T00:00:00Z' })],
      pix,
    )
    expect(await screen.findByLabelText('Pix Copia e Cola')).toHaveValue('CODIGO-JA-GERADO')
    expect(pix.gerar).not.toHaveBeenCalled()
  })

  it('quando o pagamento é confirmado, o bloco do Pix some e o pedido segue', async () => {
    abrir([ok(), ok({ status: 'novo', pagamentoStatus: 'pago' })], pixOk())
    expect(await screen.findByRole('heading', { name: 'Pague com Pix' })).toBeInTheDocument()
    await avancar(10_000)
    expect(
      await screen.findByText('Pagamento confirmado! Seu pedido entrou na fila da cozinha.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pague com Pix' })).not.toBeInTheDocument()
  })

  it('"Já paguei" consulta o pedido na hora, sem esperar os 10 s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const buscar = abrir([ok(), ok({ status: 'novo', pagamentoStatus: 'pago' })], pixOk())
    await screen.findByRole('img', { name: /QR Code/ })
    const antes = buscar.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Já paguei' }))
    expect(buscar.mock.calls.length).toBeGreaterThan(antes)
  })

  it('pedido já pago ou em andamento: nenhum Pix é pedido', async () => {
    const pix = pixOk()
    abrir([ok({ status: 'em_preparo', pagamentoStatus: 'pago' })], pix)
    await screen.findByRole('heading', { name: 'Pedido nº 7' })
    expect(pix.gerar).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Pague com Pix' })).not.toBeInTheDocument()
  })
})
