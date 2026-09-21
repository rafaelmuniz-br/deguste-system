import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ApiFotosAdmin } from '../../data/fotosAdminApi.ts'
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
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    const hamb = await screen.findByRole('region', { name: 'Hambúrgueres' })
    expect(within(hamb).getByText('Jackfino')).toBeInTheDocument()
    expect(within(hamb).getByText(/21,90/)).toBeInTheDocument()
    const beb = screen.getByRole('region', { name: 'Bebidas' })
    expect(within(beb).getByText('Guaraná')).toBeInTheDocument()
  })

  it('filtra por categoria', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    await screen.findByText('Jackfino')
    await user.selectOptions(screen.getByLabelText('Mostrar categoria'), 'Bebidas')
    expect(screen.queryByText('Jackfino')).not.toBeInTheDocument()
    expect(screen.getByText('Guaraná')).toBeInTheDocument()
  })

  it('marcar esgotado rápido e desfazer, sem abrir formulário', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
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
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Subir Smash Duplo' }))
    expect(api.reordenarProdutos).toHaveBeenCalledWith(['p2', 'p1'])
    expect(await screen.findByRole('button', { name: 'Subir Jackfino' })).toBeEnabled()
  })

  it('sem categorias: pede para criar uma antes e bloqueia o botão', async () => {
    render(
      <MemoryRouter>
        <Produtos api={catalogoAdminFalso().api} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Crie uma categoria antes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo produto' })).toBeDisabled()
  })

  it('produto escondido do cardápio aparece marcado', async () => {
    const { api } = catalogoAdminFalso(cats(), [produto({ ativo: false })])
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Escondido do cardápio')).toBeInTheDocument()
  })

  it('acessibilidade (axe): lista e formulário', async () => {
    const { api } = catalogoAdminFalso(cats(), prods())
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    await screen.findByText('Jackfino')
    expect(await violacoes()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Editar Jackfino' }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })
})

describe('Admin: fotos do produto', () => {
  function fotosFalsas(resposta: { ok: true } | { ok: false; mensagem: string } = { ok: true }) {
    const api = {
      enviar: vi.fn(async () => resposta),
      remover: vi.fn(async () => resposta),
      urlPublica: (p: string) => `https://cdn.exemplo/${p}`,
      urlMiniatura: (p: string) => `https://cdn.exemplo/${p.replace('.webp', '-mini.webp')}`,
    }
    return api as ApiFotosAdmin & typeof api
  }
  const abrirComFotos = (produtos = prods(), fotos = fotosFalsas()) => {
    const { api } = catalogoAdminFalso(cats(), produtos)
    render(
      <MemoryRouter>
        <Produtos api={api} fotos={fotos} />
      </MemoryRouter>,
    )
    return { api, fotos }
  }

  it('produto com foto mostra miniatura na lista e a prévia no formulário (com alt)', async () => {
    const user = userEvent.setup()
    abrirComFotos([produto({ fotoPath: 'p1/a.webp' })])
    const lista = await screen.findByRole('region', { name: 'Hambúrgueres' })
    expect(lista.querySelector('img.admin-miniatura')).toHaveAttribute(
      'src',
      'https://cdn.exemplo/p1/a-mini.webp',
    )

    await user.click(screen.getByRole('button', { name: 'Editar Jackfino' }))
    expect(screen.getByAltText('Foto atual de Jackfino')).toHaveAttribute(
      'src',
      'https://cdn.exemplo/p1/a.webp',
    )
  })

  it('escolher uma foto envia com o produto e a foto anterior', async () => {
    const user = userEvent.setup()
    const { fotos } = abrirComFotos([produto({ fotoPath: 'p1/antiga.webp' })])
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))

    const arquivo = new File(['x'], 'lanche.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText(/Foto do produto/), arquivo)

    expect(fotos.enviar).toHaveBeenCalledWith('p1', arquivo, 'p1/antiga.webp')
    expect(await screen.findByText('Foto atualizada.')).toBeInTheDocument()
  })

  it('erro ao enviar aparece na tela', async () => {
    const user = userEvent.setup()
    abrirComFotos(prods(), fotosFalsas({ ok: false, mensagem: 'A foto é muito grande.' }))
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))
    await user.upload(
      screen.getByLabelText(/Foto do produto/),
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByText('A foto é muito grande.')).toBeInTheDocument()
  })

  it('remover foto', async () => {
    const user = userEvent.setup()
    const { fotos } = abrirComFotos([produto({ fotoPath: 'p1/a.webp' })])
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))
    await user.click(screen.getByRole('button', { name: 'Remover foto' }))
    expect(fotos.remover).toHaveBeenCalledWith('p1', 'p1/a.webp')
    expect(await screen.findByText('Foto removida.')).toBeInTheDocument()
  })

  it('produto novo: pede para salvar antes de enviar a foto', async () => {
    const user = userEvent.setup()
    abrirComFotos()
    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))
    expect(screen.getByText(/Salve o produto primeiro/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Foto do produto/)).not.toBeInTheDocument()
  })

  it('sem a API de fotos, o formulário não mostra a seção', async () => {
    const user = userEvent.setup()
    const { api } = catalogoAdminFalso(cats(), prods())
    render(
      <MemoryRouter>
        <Produtos api={api} />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))
    expect(screen.queryByLabelText(/Foto do produto/)).not.toBeInTheDocument()
  })

  it('acessibilidade (axe) com foto', async () => {
    const user = userEvent.setup()
    abrirComFotos([produto({ fotoPath: 'p1/a.webp' })])
    await user.click(await screen.findByRole('button', { name: 'Editar Jackfino' }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })
})
