import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { catalogoAdminFalso, categoria, produto } from '../../test/catalogoAdminFalso.ts'
import Categorias from './Categorias.tsx'

const duas = () => [
  categoria({ id: 'c1', nome: 'Hambúrgueres', ordem: 10 }),
  categoria({ id: 'c2', nome: 'Bebidas', ordem: 20, ativo: false, descricao: 'Geladas' }),
]

const nomes = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => li.querySelector('strong')?.textContent)
    .filter(Boolean)

describe('Admin: categorias', () => {
  it('lista todas, inclusive as inativas (marcadas)', async () => {
    const { api } = catalogoAdminFalso(duas())
    render(<Categorias api={api} />)
    expect(await screen.findByText('Hambúrgueres')).toBeInTheDocument()
    expect(screen.getByText('Bebidas')).toBeInTheDocument()
    expect(screen.getByText('Inativa')).toBeInTheDocument()
    expect(screen.getByText('Geladas')).toBeInTheDocument()
  })

  it('mostra convite quando ainda não há categorias', async () => {
    render(<Categorias api={catalogoAdminFalso().api} />)
    expect(await screen.findByText(/Nenhuma categoria ainda/)).toBeInTheDocument()
  })

  it('cria uma categoria nova (vai para o fim da lista)', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    await user.type(screen.getByLabelText('Nome'), '  Sobremesas ')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Categoria salva.')).toBeInTheDocument()
    expect(api.salvarCategoria).toHaveBeenCalledWith(
      { nome: 'Sobremesas', descricao: null, ativo: true },
      undefined,
    )
    expect(nomes()).toEqual(['Hambúrgueres', 'Bebidas', 'Sobremesas'])
  })

  it('nome vazio: mostra o erro e não chama o banco', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Informe o nome da categoria/)
    expect(api.salvarCategoria).not.toHaveBeenCalled()
  })

  it('edita: desativar tira do cardápio mas mantém na lista', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Editar Hambúrgueres' }))
    await user.click(screen.getByLabelText('Aparece no cardápio'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Categoria salva.')
    expect(api.salvarCategoria).toHaveBeenCalledWith(
      expect.objectContaining({ ativo: false }),
      'c1',
    )
    expect(screen.getAllByText('Inativa')).toHaveLength(2)
  })

  it('reordena com as setas; as pontas ficam desabilitadas', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await screen.findByText('Hambúrgueres')
    expect(screen.getByRole('button', { name: 'Subir Hambúrgueres' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descer Bebidas' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Subir Bebidas' }))

    expect(api.reordenarCategorias).toHaveBeenCalledWith(['c2', 'c1'])
    await screen.findByRole('button', { name: 'Subir Hambúrgueres' })
    expect(nomes()).toEqual(['Bebidas', 'Hambúrgueres'])
  })

  it('exclui categoria vazia depois de confirmar', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Excluir Bebidas' }))
    expect(api.excluirCategoria).not.toHaveBeenCalled() // ainda pediu confirmação
    await user.click(screen.getByRole('button', { name: 'Excluir de vez' }))
    expect(await screen.findByText('Categoria "Bebidas" excluída.')).toBeInTheDocument()
    expect(screen.queryByText('Geladas')).not.toBeInTheDocument()
  })

  it('categoria com produtos não é excluída: explica o motivo', async () => {
    const { api } = catalogoAdminFalso(duas(), [produto({ categoriaId: 'c1' })])
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Excluir Hambúrgueres' }))
    await user.click(screen.getByRole('button', { name: 'Excluir de vez' }))
    expect(await screen.findByText(/ainda tem produtos/)).toBeInTheDocument()
    expect(screen.getByText('Hambúrgueres')).toBeInTheDocument()
  })

  it('falha do banco ao salvar: mostra a mensagem dentro do formulário', async () => {
    const { api, estado } = catalogoAdminFalso(duas())
    estado.falhaAoSalvar = 'Sem permissão para alterar.'
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    await user.type(screen.getByLabelText('Nome'), 'Sobremesas')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão para alterar.')
  })

  it('falha ao carregar: avisa e permite tentar de novo', async () => {
    const { api, estado } = catalogoAdminFalso(duas())
    estado.falhaAoListar = true
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/Não foi possível carregar/)
    estado.falhaAoListar = false
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Hambúrgueres')).toBeInTheDocument()
  })

  it('acessibilidade (axe): lista e formulário', async () => {
    const { api } = catalogoAdminFalso(duas())
    const user = userEvent.setup()
    render(<Categorias api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }))
    await screen.findByRole('dialog')
    const r = await axe.run(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
