import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Cardapio from './Cardapio.tsx'

const normal = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

async function abrir(loja: 'aberta' | 'fechada' = 'aberta') {
  const user = userEvent.setup()
  const tela = render(
    <MemoryRouter initialEntries={[`/?loja=${loja}`]}>
      <Cardapio />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Deguste Burguer' })
  return { user, tela, loja }
}

beforeEach(() => localStorage.clear())

describe('Cardápio público', () => {
  it('lista as categorias e produtos, com esgotado bloqueado', async () => {
    await abrir()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Smashs 90g Black Angus' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jackfino/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Brownie/ })).toBeDisabled()
  })

  it('busca sem diferenciar acento e esconde categorias vazias', async () => {
    const { user } = await abrir()
    await user.type(screen.getByRole('searchbox'), 'boladao')
    expect(screen.getByRole('button', { name: /Boladão/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Jackfino/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Bebidas' })).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'xyz')
    expect(screen.getByText(/Nenhum item encontrado/)).toBeInTheDocument()
  })

  it('monta um item com adicionais, soma o preço e leva para a sacola', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: /Jackfino/ }))
    const dialogo = screen.getByRole('dialog', { name: 'Jackfino' })

    await user.click(within(dialogo).getByRole('checkbox', { name: /Bacon extra/ }))
    await user.click(within(dialogo).getByRole('checkbox', { name: /Ovo/ }))
    const adicionar = within(dialogo).getByRole('button', { name: /Adicionar/ })
    expect(normal(adicionar.textContent)).toContain('R$ 28,49') // 21,99 + 4,00 + 2,50
    expect(within(dialogo).getByRole('checkbox', { name: /Picles/ })).toBeDisabled()

    await user.click(
      within(dialogo).getByRole('button', { name: 'Aumentar quantidade de Jackfino' }),
    )
    expect(normal(adicionar.textContent)).toContain('R$ 56,98')
    await user.click(adicionar)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const barra = screen.getByRole('button', { name: /Ver sacola \(2\)/ })
    expect(normal(barra.textContent)).toContain('R$ 56,98')

    await user.click(barra)
    const sacola = screen.getByRole('dialog', { name: 'Sua sacola' })
    expect(within(sacola).getByText('Adicionais: Bacon extra, Ovo')).toBeInTheDocument()
    expect(within(sacola).getByRole('button', { name: /Finalizar pedido/ })).toBeDisabled()
  })

  it('combo só libera o botão depois das escolhas obrigatórias', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: /Combo Smash/ }))
    const dialogo = screen.getByRole('dialog')
    const adicionar = within(dialogo).getByRole('button', { name: /Adicionar/ })
    expect(adicionar).toBeDisabled()

    await user.click(within(dialogo).getByRole('radio', { name: /Xeque Mate/ }))
    expect(adicionar).toBeDisabled() // falta a bebida
    await user.click(within(dialogo).getByRole('radio', { name: /Coca-Cola lata/ }))
    expect(adicionar).toBeEnabled()
    expect(normal(adicionar.textContent)).toContain('R$ 43,99') // 39,99 + 4,00 do Xeque Mate
  })

  it('limita a 3 adicionais: ao atingir o máximo, as demais opções ficam bloqueadas', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: /Jackfino/ }))
    const dialogo = screen.getByRole('dialog')
    const cebola = within(dialogo).getByRole('checkbox', { name: /Cebola caramelizada/ })
    await user.click(within(dialogo).getByRole('checkbox', { name: /Bacon extra/ }))
    await user.click(within(dialogo).getByRole('checkbox', { name: /Queijo extra/ }))
    expect(cebola).toBeEnabled()
    await user.click(within(dialogo).getByRole('checkbox', { name: /Ovo/ }))
    expect(cebola).toBeDisabled()
    // Desmarcar uma libera de novo. Total: 21,99 + 4,00 + 3,00 + 2,50 = 31,49
    const adicionar = within(dialogo).getByRole('button', { name: /Adicionar/ })
    expect(normal(adicionar.textContent)).toContain('R$ 31,49')
    await user.click(within(dialogo).getByRole('checkbox', { name: /Ovo/ }))
    expect(cebola).toBeEnabled()
  })

  it('loja fechada: dá para ver o cardápio, mas não adicionar', async () => {
    const { user } = await abrir('fechada')
    expect(screen.getByText(/só é possível pedir enquanto estivermos abertos/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Água mineral/ }))
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeDisabled()
    expect(screen.getByText(/A loja está fechada/)).toBeInTheDocument()
  })

  it('a sacola é salva no navegador e volta ao reabrir a página', async () => {
    const { user, tela } = await abrir()
    await user.click(screen.getByRole('button', { name: /Água mineral/ }))
    await user.click(screen.getByRole('button', { name: /Adicionar/ }))
    expect(localStorage.getItem('deguste:sacola:v1')).toContain('beb-agua')

    tela.unmount() // "fecha a aba"
    await abrir() // "abre de novo": o localStorage continua
    expect(screen.getByRole('button', { name: /Ver sacola \(1\)/ })).toBeInTheDocument()
  })

  it('remover o último item esvazia a sacola', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: /Água mineral/ }))
    await user.click(screen.getByRole('button', { name: /Adicionar/ }))
    await user.click(screen.getByRole('button', { name: /Ver sacola/ }))
    await user.click(screen.getByRole('button', { name: 'Remover Água mineral da sacola' }))
    expect(screen.getByText('Sua sacola está vazia.')).toBeInTheDocument()
  })

  it('Esc fecha o diálogo', async () => {
    const { user } = await abrir()
    await user.click(screen.getByRole('button', { name: /Jackfino/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
