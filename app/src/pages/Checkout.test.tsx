import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'

const normal = (s: string | null) => (s ?? '').replace(/\s/g, ' ')

const linhaAgua = { id: 'l1', produtoId: 'beb-agua', quantidade: 1, escolhas: {}, observacao: '' }

/** Abre direto o checkout, com a sacola já preenchida como se viesse do cardápio. */
async function abrirCheckout(opcoes: { loja?: 'aberta' | 'fechada'; sacola?: object[] } = {}) {
  const { loja = 'aberta', sacola = [linhaAgua] } = opcoes
  localStorage.setItem('deguste:sacola:v1', JSON.stringify(sacola))
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[`/pedido?loja=${loja}`]}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: /Finalizar pedido/ })
  return user
}

type Usuario = Awaited<ReturnType<typeof abrirCheckout>>

async function preencherCliente(user: Usuario, telefone = '(71) 99999-1234') {
  await user.type(screen.getByLabelText('Nome'), 'Maria Silva')
  await user.type(screen.getByLabelText('Telefone (com DDD)'), telefone)
}

async function preencherEndereco(user: Usuario, bairro = 'Pituba') {
  await user.type(screen.getByLabelText('Rua'), 'Rua das Flores')
  await user.type(screen.getByLabelText('Número'), '10')
  await user.type(screen.getByLabelText('Bairro'), bairro)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Checkout', () => {
  it('sacola vazia: avisa e oferece voltar ao cardápio', async () => {
    localStorage.setItem('deguste:sacola:v1', '[]')
    render(
      <MemoryRouter initialEntries={['/pedido?loja=aberta']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Sua sacola está vazia.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao cardápio' })).toBeInTheDocument()
  })

  it('loja fechada: mostra o aviso e não deixa continuar', async () => {
    await abrirCheckout({ loja: 'fechada' })
    expect(
      screen.getByText(/Só é possível finalizar o pedido enquanto estivermos abertos/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver total' })).toBeDisabled()
  })

  it('retirada: revisa o total sem frete, confirma e limpa a sacola', async () => {
    const user = await abrirCheckout()
    await preencherCliente(user)
    await user.click(screen.getByRole('radio', { name: 'Retirada no local' }))
    expect(screen.queryByLabelText('Rua')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver total' }))

    expect(await screen.findByRole('heading', { name: 'Revise seu pedido' })).toHaveFocus()
    expect(screen.getByText(/Você retira no local/)).toBeInTheDocument()
    expect(screen.getByText(/\(71\) 99999-1234/)).toBeInTheDocument()
    const confirmar = screen.getByRole('button', { name: /Confirmar pedido/ })
    expect(normal(confirmar.textContent)).toContain('R$ 4,00')

    await user.click(confirmar)
    expect(
      await screen.findByRole('heading', { name: /Pedido nº 1001 registrado/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/PEDIDO DE TESTE/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Andamento do pedido' })).toBeInTheDocument()
    expect(localStorage.getItem('deguste:sacola:v1')).toBe('[]')
  })

  it('entrega: o frete vem do servidor e entra no total', async () => {
    const user = await abrirCheckout()
    await preencherCliente(user)
    await preencherEndereco(user)
    await user.click(screen.getByRole('button', { name: 'Ver total' }))

    await screen.findByRole('heading', { name: 'Revise seu pedido' })
    // 500 + 150 x 3,2 km = 980 de frete; total 400 + 980 = 1.380
    expect(normal(screen.getByText('Taxa de entrega').nextSibling?.textContent ?? '')).toBe(
      'R$ 9,80',
    )
    expect(normal(screen.getByRole('button', { name: /Confirmar pedido/ }).textContent)).toContain(
      'R$ 13,80',
    )
    expect(screen.getByText(/Entrega: Rua das Flores, 10 — Pituba/)).toBeInTheDocument()
  })

  it('endereço fora da área: recusa com mensagem clara', async () => {
    const user = await abrirCheckout()
    await preencherCliente(user)
    await preencherEndereco(user, 'Paripe')
    await user.click(screen.getByRole('button', { name: 'Ver total' }))
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText(/Ainda não entregamos nesse endereço/)).toBeInTheDocument()
    expect(alerta).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Finalizar pedido' })).toBeInTheDocument()
  })

  it('dados inválidos: mostra os erros e marca os campos', async () => {
    const user = await abrirCheckout()
    await user.type(screen.getByLabelText('Nome'), 'M')
    await user.type(screen.getByLabelText('Telefone (com DDD)'), '123')
    await user.click(screen.getByRole('button', { name: 'Ver total' }))

    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText('Informe seu nome.')).toBeInTheDocument()
    expect(within(alerta).getByText('Informe um telefone com DDD válido.')).toBeInTheDocument()
    expect(within(alerta).getByText(/Informe rua, número e bairro/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Telefone (com DDD)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('"Voltar e editar" preserva o que foi digitado', async () => {
    const user = await abrirCheckout()
    await preencherCliente(user)
    await user.click(screen.getByRole('radio', { name: 'Retirada no local' }))
    await user.click(screen.getByRole('button', { name: 'Ver total' }))
    await screen.findByRole('heading', { name: 'Revise seu pedido' })
    await user.click(screen.getByRole('button', { name: 'Voltar e editar' }))
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria Silva')
  })

  it('jornada: cardápio -> sacola -> finalizar (com o mesmo estado da loja)', async () => {
    localStorage.setItem('deguste:sacola:v1', '[]')
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/?loja=aberta']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /Água mineral/ }))
    await user.click(screen.getByRole('button', { name: /Adicionar/ }))
    await user.click(screen.getByRole('button', { name: /Ver sacola/ }))
    await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }))

    // O override de dev (?loja=aberta) continua valendo depois de trocar de página.
    await screen.findByRole('heading', { level: 1, name: /Finalizar pedido/ })
    expect(screen.getByRole('button', { name: 'Ver total' })).toBeEnabled()
    expect(screen.getByText('1× Água mineral', { exact: false })).toBeInTheDocument()
  })
})
