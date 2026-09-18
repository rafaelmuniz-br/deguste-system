import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import type { ApiRelatorios } from '../../data/relatoriosApi.ts'
import type { RelatorioVendas } from '../../domain/relatorios.ts'
import Relatorios from './Relatorios.tsx'

const AGORA = () => new Date('2026-09-18T15:00:00Z') // 18/09/2026, meio-dia na Bahia

const relatorio = (extra: Partial<RelatorioVendas> = {}): RelatorioVendas => ({
  inicio: '2026-09-12',
  fim: '2026-09-18',
  resumo: { pedidos: 4, receitaCentavos: 13995, ticketMedioCentavos: 3499, cancelados: 1 },
  porDia: [
    { dia: '2026-09-17', pedidos: 3, receitaCentavos: 10596 },
    { dia: '2026-09-18', pedidos: 1, receitaCentavos: 3399 },
  ],
  porCanal: [
    { canal: 'proprio', pedidos: 3, receitaCentavos: 9996 },
    { canal: 'ifood', pedidos: 1, receitaCentavos: 3999 },
  ],
  porTipo: [
    { tipo: 'retirada', pedidos: 3, receitaCentavos: 9996 },
    { tipo: 'entrega', pedidos: 1, receitaCentavos: 3999 },
  ],
  porHora: [
    { hora: 19, pedidos: 2 },
    { hora: 20, pedidos: 2 },
  ],
  produtos: [
    {
      produtoId: 'p1',
      nome: 'Smash Exemplo',
      unidades: 3,
      unidadesEmCombo: 0,
      receitaAvulsaCentavos: 6597,
    },
    {
      produtoId: 'p2',
      nome: 'Burguer Exemplo',
      unidades: 2,
      unidadesEmCombo: 1,
      receitaAvulsaCentavos: 3399,
    },
    {
      produtoId: 'p3',
      nome: 'Refrigerante Exemplo',
      unidades: 1,
      unidadesEmCombo: 1,
      receitaAvulsaCentavos: 0,
    },
  ],
  ...extra,
})

function apiFalsa(r: RelatorioVendas = relatorio()) {
  const vendas = vi.fn<ApiRelatorios['vendas']>(async () => r)
  return { api: { vendas } as ApiRelatorios, vendas }
}

const abrir = (api: ApiRelatorios) => render(<Relatorios api={api} agora={AGORA} />)

describe('Admin: relatórios de vendas', () => {
  it('abre com os últimos 7 dias (no fuso da Bahia) e mostra o resumo', async () => {
    const { api, vendas } = apiFalsa()
    abrir(api)
    expect(await screen.findByText('Ticket médio')).toBeInTheDocument()
    expect(vendas).toHaveBeenCalledWith('2026-09-12', '2026-09-18')
    expect(screen.getByRole('button', { name: 'Últimos 7 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const resumo = screen.getByText('Pedidos', { selector: 'dt' }).closest('dl')!
    expect(within(resumo).getByText('4')).toBeInTheDocument()
    expect(within(resumo).getByText(/139,95/)).toBeInTheDocument()
    expect(within(resumo).getByText(/34,99/)).toBeInTheDocument() // ticket médio
    expect(within(resumo).getByText('1')).toBeInTheDocument() // cancelados
  })

  it('tabelas por dia, horário de pico, canal/tipo e produtos', async () => {
    abrir(apiFalsa().api)
    const porDia = await screen.findByRole('table', { name: 'Vendas por dia' })
    expect(within(porDia).getByRole('rowheader', { name: 'qui 17/09' })).toBeInTheDocument()
    expect(within(porDia).getByText(/105,96/)).toBeInTheDocument()

    const pico = screen.getByRole('table', { name: 'Pedidos por hora do dia' })
    expect(within(pico).getByRole('rowheader', { name: '19h' })).toBeInTheDocument()

    const canais = screen.getByRole('table', { name: 'Vendas por canal e por tipo de pedido' })
    expect(within(canais).getByRole('rowheader', { name: 'Site próprio' })).toBeInTheDocument()
    expect(within(canais).getByRole('rowheader', { name: 'iFood' })).toBeInTheDocument()
    expect(within(canais).getByRole('rowheader', { name: 'Entrega' })).toBeInTheDocument()

    const produtos = screen.getByRole('table', { name: 'Produtos mais vendidos' })
    const linhaBurguer = within(produtos).getByRole('row', { name: /Burguer Exemplo/ })
    expect(within(linhaBurguer).getAllByRole('cell')[0]).toHaveTextContent('2') // unidades
    expect(within(linhaBurguer).getAllByRole('cell')[1]).toHaveTextContent('1') // em combos
    // sem receita avulsa: traço, não R$ 0,00 enganoso
    const linhaRefri = within(produtos).getByRole('row', { name: /Refrigerante Exemplo/ })
    expect(within(linhaRefri).getByText('—')).toBeInTheDocument()
  })

  it('trocar o período busca de novo com as datas certas', async () => {
    const { api, vendas } = apiFalsa()
    const user = userEvent.setup()
    abrir(api)
    await screen.findByText('Ticket médio')

    await user.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(vendas).toHaveBeenLastCalledWith('2026-09-18', '2026-09-18')
    await user.click(screen.getByRole('button', { name: 'Ontem' }))
    expect(vendas).toHaveBeenLastCalledWith('2026-09-17', '2026-09-17')
    await user.click(screen.getByRole('button', { name: 'Este mês' }))
    expect(vendas).toHaveBeenLastCalledWith('2026-09-01', '2026-09-18')
    await user.click(screen.getByRole('button', { name: 'Últimos 30 dias' }))
    expect(vendas).toHaveBeenLastCalledWith('2026-08-20', '2026-09-18')
    expect(screen.getByRole('button', { name: 'Últimos 30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('período personalizado', async () => {
    const { api, vendas } = apiFalsa()
    const user = userEvent.setup()
    abrir(api)
    await screen.findByText('Ticket médio')

    await user.clear(screen.getByLabelText('De'))
    await user.type(screen.getByLabelText('De'), '2026-08-01')
    await user.clear(screen.getByLabelText('Até'))
    await user.type(screen.getByLabelText('Até'), '2026-08-15')
    await user.click(screen.getByRole('button', { name: 'Ver período' }))

    expect(vendas).toHaveBeenLastCalledWith('2026-08-01', '2026-08-15')
    expect(screen.getByRole('button', { name: 'Ver período' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('datas invertidas: avisa e NÃO consulta o banco', async () => {
    const { api, vendas } = apiFalsa()
    const user = userEvent.setup()
    abrir(api)
    await screen.findByText('Ticket médio')
    vendas.mockClear()

    await user.clear(screen.getByLabelText('De'))
    await user.type(screen.getByLabelText('De'), '2026-09-18')
    await user.clear(screen.getByLabelText('Até'))
    await user.type(screen.getByLabelText('Até'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Ver período' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/antes da inicial/)
    expect(vendas).not.toHaveBeenCalled()
  })

  it('período sem vendas: mostra zeros e uma frase, sem tabelas vazias', async () => {
    const vazio = relatorio({
      resumo: { pedidos: 0, receitaCentavos: 0, ticketMedioCentavos: 0, cancelados: 0 },
      porDia: [],
      porCanal: [],
      porTipo: [],
      porHora: [],
      produtos: [],
    })
    abrir(apiFalsa(vazio).api)
    expect(await screen.findByText('Nenhuma venda neste período.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('falha do banco: mensagem clara, e trocar de período tenta de novo', async () => {
    const { api, vendas } = apiFalsa()
    vendas.mockRejectedValueOnce(new Error('rede'))
    const user = userEvent.setup()
    abrir(api)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Não foi possível carregar o relatório/,
    )

    await user.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(await screen.findByText('Ticket médio')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resposta atrasada de um período antigo não sobrescreve o período atual', async () => {
    let liberarPrimeira: (r: RelatorioVendas) => void = () => {}
    const vendas = vi
      .fn<ApiRelatorios['vendas']>()
      .mockImplementationOnce(() => new Promise((res) => (liberarPrimeira = res)))
      .mockResolvedValueOnce(
        relatorio({
          resumo: { pedidos: 9, receitaCentavos: 90000, ticketMedioCentavos: 10000, cancelados: 0 },
        }),
      )
    const user = userEvent.setup()
    abrir({ vendas })
    await user.click(screen.getByRole('button', { name: 'Hoje' })) // 2ª consulta responde primeiro
    expect(await screen.findByText(/900,00/)).toBeInTheDocument()

    liberarPrimeira(relatorio()) // a 1ª chega atrasada
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByText(/900,00/)).toBeInTheDocument()
    expect(screen.queryByText(/139,95/)).not.toBeInTheDocument()
  })

  it('acessibilidade (axe)', async () => {
    abrir(apiFalsa().api)
    await screen.findByText('Ticket médio')
    const r = await axe.run(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(
      r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes[0]?.html.slice(0, 80)}`),
    ).toEqual([])
  })
})
