import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'

// Auditoria automática de acessibilidade (axe-core, regras WCAG 2.x A/AA) nas telas principais.
// O contraste de cor NÃO é checado aqui (o jsdom não tem layout): ele tem teste próprio em
// contraste.test.ts. O axe acha ~1/3 dos problemas; teclado e leitor de tela ainda pedem revisão
// manual (ver docs/acessibilidade.md).

async function violacoes(): Promise<string[]> {
  const r = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return r.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .slice(0, 2)
        .map((n) => n.html.slice(0, 90))
        .join(' | ')}`,
  )
}

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('acessibilidade (axe-core)', () => {
  it('cardápio', async () => {
    abrir('/?loja=aberta')
    await screen.findByRole('heading', { level: 1, name: 'Deguste Burguer' })
    expect(await violacoes()).toEqual([])
  })

  it('cardápio com a loja fechada', async () => {
    abrir('/?loja=fechada')
    await screen.findByRole('heading', { level: 1, name: 'Deguste Burguer' })
    expect(await violacoes()).toEqual([])
  })

  it('produto com opções aberto (diálogo com contadores e observação)', async () => {
    const user = userEvent.setup()
    abrir('/?loja=aberta')
    await user.click(await screen.findByRole('button', { name: /Jackfino/ }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })

  it('combo aberto (grupos obrigatórios com rádios)', async () => {
    const user = userEvent.setup()
    abrir('/?loja=aberta')
    await user.click(await screen.findByRole('button', { name: /Combo Smash/ }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })

  it('sacola aberta', async () => {
    const user = userEvent.setup()
    abrir('/?loja=aberta')
    await user.click(await screen.findByRole('button', { name: /Água mineral/ }))
    await user.click(screen.getByRole('button', { name: /Adicionar/ }))
    await user.click(screen.getByRole('button', { name: /Ver sacola/ }))
    await screen.findByRole('dialog', { name: 'Sua sacola' })
    expect(await violacoes()).toEqual([])
  })

  describe('checkout', () => {
    beforeEach(() => {
      localStorage.setItem(
        'deguste:sacola:v1',
        JSON.stringify([
          { id: 'l1', produtoId: 'beb-agua', quantidade: 1, escolhas: {}, observacao: '' },
        ]),
      )
    })

    it('formulário (entrega)', async () => {
      abrir('/pedido?loja=aberta')
      await screen.findByRole('heading', { level: 1, name: /Finalizar pedido/ })
      expect(await violacoes()).toEqual([])
    })

    it('formulário com erros de validação', async () => {
      const user = userEvent.setup()
      abrir('/pedido?loja=aberta')
      await user.click(await screen.findByRole('button', { name: 'Ver total' }))
      await screen.findByRole('alert')
      expect(await violacoes()).toEqual([])
    })

    it('revisão do total e pedido registrado', async () => {
      const user = userEvent.setup()
      abrir('/pedido?loja=aberta')
      await user.type(await screen.findByLabelText('Nome'), 'Maria Silva')
      await user.type(screen.getByLabelText('Telefone (com DDD)'), '71999991234')
      await user.click(screen.getByRole('radio', { name: 'Retirada no local' }))
      await user.click(screen.getByRole('button', { name: 'Ver total' }))
      await screen.findByRole('heading', { name: 'Revise seu pedido' })
      expect(await violacoes()).toEqual([])
      await user.click(screen.getByRole('button', { name: /Confirmar pedido/ }))
      await screen.findByRole('heading', { name: /Pedido nº \d+ registrado/ })
      expect(await violacoes()).toEqual([])
    })
  })

  it('acompanhamento do pedido', async () => {
    const token = '3f2c9d1e-8a4b-4c6d-9e1f-2a3b4c5d6e7f'
    localStorage.setItem(
      'deguste:dev-pedidos',
      JSON.stringify({
        [token]: { numero: 9, tipo: 'entrega', totalCentavos: 3579, criadoEm: Date.now() - 20_000 },
      }),
    )
    abrir(`/acompanhar/${token}`)
    await screen.findByRole('heading', { name: 'Pedido nº 9' })
    expect(await violacoes()).toEqual([])
  })

  it.each([
    ['/privacidade', 'Política de Privacidade'],
    ['/termos', 'Termos de Uso'],
    ['/cancelamento', 'Cancelamento e reembolso'],
    ['/faq', 'Perguntas frequentes'],
  ])('página legal %s', async (rota, titulo) => {
    abrir(rota)
    await screen.findByRole('heading', { level: 1, name: titulo })
    expect(await violacoes()).toEqual([])
  })

  it('login do painel admin', async () => {
    abrir('/admin')
    // O painel é carregado sob demanda: a primeira importação (transformar o código) pode passar de 1 s.
    await screen.findByText(/não está conectado ao banco/, {}, { timeout: 10_000 })
    expect(await violacoes()).toEqual([])
  })
})
