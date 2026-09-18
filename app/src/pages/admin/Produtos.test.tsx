import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { catalogoAdminFalso, categoria, produto } from '../../test/catalogoAdminFalso.ts'
import Produtos from './Produtos.tsx'

const cats = () => [
  categoria({ id: 'c1', nome: 'Hambúrgueres', ordem: 10 }),
  categoria({ id: 'c2', nome: 'Bebidas', ordem: 20 }),
]
const prods = () => [
  produto({ id: 'p1', nome: 'Jackfino', ordem: 10, precoCentavos: 2190 }),
  produto({ id: 'p2', nome: 'Smash Duplo', ordem: 20, precoCentavos: 2890 }),
  produto({ id: 'p3', nome: 'Guaraná', categoriaId: 'c2', ordem: 30, precoCentavos: 600 }),
]

const opcoesAxe = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
  },
  rules: { 'color-contrast': { enabled: false } },
}
const violacoes = async () =>
  (await axe.run(document.body, opcoesAxe)).violations.map((v) => `${v.id}: ${v.help}`)

describe('Admin: produtos', () => {
  it('lista os produtos agrupados por categoria, com preço em reais', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    render(<Produtos api={api} />)
    const hamb = await screen.findByRole('region', { name: 'Hambúrgueres' })
    expect(within(hamb).getByText('Jackfino')).toBeInTheDocument()
    expect(within(hamb).getByText(/21,90/)).toBeInTheDocument()
    const beb = screen.getByRole('region', { name: 'Bebidas' })
    expect(within(beb).getByText('Guaraná')).toBeInTheDocument()
  })

  it('filtra por categoria', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await screen.findByText('Jackfino')
    await user.selectOptions(screen.getByLabelText('Mostrar categoria'), 'Bebidas')
    expect(screen.queryByText('Jackfino')).not.toBeInTheDocument()
    expect(screen.getByText('Guaraná')).toBeInTheDocument()
  })

  it('marcar esgotado rápido e desfazer, sem abrir formulário', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Marcar esgotado: Jackfino' }))

    expect(api.alterarDisponibilidade).toHaveBeenCalledWith('p1', false)
    expect(await screen.findByText('"Jackfino" marcado como esgotado.')).toBeInTheDocument()
    expect(screen.getByText('Esgotado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltou ao estoque: Jackfino' }))
    expect(api.alterarDisponibilidade).toHaveBeenLastCalledWith('p1', true)
    expect(await screen.findByText('"Jackfino" voltou a ficar disponível.')).toBeInTheDocument()
    expect(screen.queryByText('Esgotado')).not.toBeInTheDocument()
  })

  it('cria produto convertendo o preço em reais para centavos', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Bebidas')
    await user.type(screen.getByLabelText('Nome'), 'Suco de Cajá')
    await user.type(screen.getByLabelText('Preço (R$)'), '8,5')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Produto salvo.')).toBeInTheDocument()
    expect(api.salvarProduto).toHaveBeenCalledWith(
      {
        categoriaId: 'c2',
        nome: 'Suco de Cajá',
        descricao: null,
        precoCentavos: 850,
        precoOriginalCentavos: null,
        ehCombo: false,
        ativo: true,
      },
      undefined,
    )
    const bebidas = screen.getByRole('region', { name: 'Bebidas' })
    expect(within(bebidas).getByText('Suco de Cajá')).toBeInTheDocument()
  })

  it('edição vem preenchida (preço em reais) e salva a mudança', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))

    const preco = screen.getByLabelText('Preço (R$)')
    expect(preco).toHaveValue('21,90')
    await user.clear(preco)
    await user.type(preco, '23,90')
    await user.type(screen.getByLabelText(/Preço “de”/), '27')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Produto salvo.')
    expect(api.salvarProduto).toHaveBeenCalledWith(
      expect.objectContaining({ precoCentavos: 2390, precoOriginalCentavos: 2700 }),
      'p1',
    )
  })

  it('preço inválido: lista o erro e não salva', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))
    await user.type(screen.getByLabelText('Nome'), 'Teste')
    await user.type(screen.getByLabelText('Preço (R$)'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Informe o preço em reais/)
    expect(api.salvarProduto).not.toHaveBeenCalled()
  })

  it('reordena dentro da categoria', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Subir Smash Duplo' }))
    expect(api.reordenarProdutos).toHaveBeenCalledWith(['p2', 'p1'])
    expect(await screen.findByRole('button', { name: 'Subir Jackfino' })).toBeEnabled()
  })

  it('sem categorias: pede para criar uma antes e bloqueia o botão', async () => {
    render(<Produtos api={catalogoAdminFalso().api} />)
    expect(await screen.findByText(/Crie uma categoria antes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo produto' })).toBeDisabled()
  })

  it('produto escondido do cardápio aparece marcado', async () => {
    const { api } = catalogoAdminFalso(cats(), [produto({ ativo: false })])
    render(<Produtos api={api} />)
    expect(await screen.findByText('Escondido do cardápio')).toBeInTheDocument()
  })

  it('acessibilidade (axe): lista e formulário', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(<Produtos api={api} />)
    await screen.findByText('Jackfino')
    expect(await violacoes()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Editar Jackfino' }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })
})
