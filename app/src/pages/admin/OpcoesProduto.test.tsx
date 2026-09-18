import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { grupo, opcao, opcoesAdminFalso } from '../../test/opcoesAdminFalso.ts'
import OpcoesProduto from './OpcoesProduto.tsx'

const ponto = () =>
  grupo({
    id: 'g1',
    nome: 'Ponto da carne',
    ordem: 10,
    opcoes: [
      opcao({ id: 'o1', nome: 'Ao ponto', ordem: 10 }),
      opcao({ id: 'o2', nome: 'Bem passado', ordem: 20 }),
    ],
  })
const adicionais = () =>
  grupo({
    id: 'g2',
    nome: 'Adicionais',
    minEscolhas: 0,
    maxEscolhas: 3,
    ordem: 20,
    opcoes: [opcao({ id: 'o3', grupoId: 'g2', nome: 'Bacon', precoAdicionalCentavos: 350 })],
  })

function abrir(api: ReturnType<typeof opcoesAdminFalso>['api']) {
  return render(
    <MemoryRouter initialEntries={['/admin/produtos/p1/opcoes']}>
      <Routes>
        <Route path="/admin/produtos/:id/opcoes" element={<OpcoesProduto api={api} />} />
        <Route path="/admin/produtos" element={<p>Lista de produtos</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const nomesDosGrupos = () =>
  screen
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent?.split('Obrigatório')[0].split('Opcional')[0].trim())

describe('Admin: opções do produto', () => {
  it('mostra grupos com a regra em português e as opções com adicional', async () => {
    const { api } = opcoesAdminFalso([ponto(), adicionais()])
    abrir(api)

    expect(
      await screen.findByRole('heading', { name: 'Opções de Combo Smash' }),
    ).toBeInTheDocument()
    expect(api.carregar).toHaveBeenCalledWith('p1')
    const g1 = screen.getByRole('region', { name: 'Ponto da carne' })
    expect(within(g1).getByText('Obrigatório: escolha 1')).toBeInTheDocument()
    expect(within(g1).getByText('Ao ponto')).toBeInTheDocument()
    const g2 = screen.getByRole('region', { name: 'Adicionais' })
    expect(within(g2).getByText('Opcional, até 3')).toBeInTheDocument()
    expect(within(g2).getByText(/\+.*3,50/)).toBeInTheDocument()
  })

  it('produto sem grupos: explica que é vendido do jeito que está', async () => {
    abrir(opcoesAdminFalso([]).api)
    expect(await screen.findByText(/não tem grupos de opção/)).toBeInTheDocument()
  })

  it('combo: lembra de ligar as opções a produtos reais', async () => {
    abrir(opcoesAdminFalso([], { ehCombo: true }).api)
    expect(await screen.findByText(/ligue cada opção a um produto real/)).toBeInTheDocument()
  })

  it('cria um grupo (obrigatório escolher 1 por padrão)', async () => {
    const { api } = opcoesAdminFalso([ponto()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Novo grupo' }))
    expect(screen.getByLabelText('Mínimo de escolhas')).toHaveValue('1')
    await user.type(screen.getByLabelText('Nome do grupo'), 'Molhos')
    await user.clear(screen.getByLabelText('Máximo de escolhas'))
    await user.type(screen.getByLabelText('Máximo de escolhas'), '2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Grupo salvo.')).toBeInTheDocument()
    expect(api.salvarGrupo).toHaveBeenCalledWith(
      'p1',
      { nome: 'Molhos', minEscolhas: 1, maxEscolhas: 2 },
      undefined,
    )
    expect(screen.getByRole('region', { name: 'Molhos' })).toBeInTheDocument()
  })

  it('grupo com mínimo maior que máximo: mostra o erro e não salva', async () => {
    const { api } = opcoesAdminFalso([])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Novo grupo' }))
    await user.type(screen.getByLabelText('Nome do grupo'), 'Molhos')
    await user.clear(screen.getByLabelText('Mínimo de escolhas'))
    await user.type(screen.getByLabelText('Mínimo de escolhas'), '3')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /mínimo de escolhas não pode ser maior/,
    )
    expect(api.salvarGrupo).not.toHaveBeenCalled()
  })

  it('edita um grupo já existente', async () => {
    const { api } = opcoesAdminFalso([ponto()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Editar grupo Ponto da carne' }))
    const nome = screen.getByLabelText('Nome do grupo')
    expect(nome).toHaveValue('Ponto da carne')
    await user.clear(nome)
    await user.type(nome, 'Ponto')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await screen.findByText('Grupo salvo.')
    expect(api.salvarGrupo).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ nome: 'Ponto' }),
      'g1',
    )
  })

  it('adiciona opção com valor adicional em reais → centavos', async () => {
    const { api } = opcoesAdminFalso([ponto()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar opção em Ponto da carne' }),
    )
    await user.type(screen.getByLabelText('Nome da opção'), 'Mal passado')
    await user.type(screen.getByLabelText(/Valor adicional/), '2,5')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Opção salva.')).toBeInTheDocument()
    expect(api.salvarOpcao).toHaveBeenCalledWith(
      'g1',
      { nome: 'Mal passado', precoAdicionalCentavos: 250, produtoId: null },
      undefined,
    )
    expect(screen.getByText('Mal passado')).toBeInTheDocument()
  })

  it('opção de combo aponta para um produto real (aparece na lista)', async () => {
    const { api } = opcoesAdminFalso([grupo({ nome: 'Escolha seu hambúrguer' })], { ehCombo: true })
    const user = userEvent.setup()
    abrir(api)
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar opção em Escolha seu hambúrguer' }),
    )
    await user.type(screen.getByLabelText('Nome da opção'), 'Smash')
    await user.selectOptions(screen.getByLabelText('Vende qual produto? (combos)'), 'Smash')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await screen.findByText('Opção salva.')
    expect(api.salvarOpcao).toHaveBeenCalledWith(
      'g1',
      { nome: 'Smash', precoAdicionalCentavos: 0, produtoId: 'p-smash' },
      undefined,
    )
    expect(screen.getByText('Produto: Smash')).toBeInTheDocument()
  })

  it('edição de opção vem preenchida', async () => {
    const { api } = opcoesAdminFalso([adicionais()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Editar opção Bacon' }))
    expect(screen.getByLabelText('Nome da opção')).toHaveValue('Bacon')
    expect(screen.getByLabelText(/Valor adicional/)).toHaveValue('3,50')
  })

  it('esgotado rápido numa opção e desfazer', async () => {
    const { api } = opcoesAdminFalso([adicionais()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Marcar esgotada: Bacon' }))
    expect(api.alterarDisponibilidade).toHaveBeenCalledWith('o3', false)
    expect(await screen.findByText('"Bacon" marcada como esgotada.')).toBeInTheDocument()
    expect(screen.getByText('Esgotada')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltou ao estoque: Bacon' }))
    expect(await screen.findByText('"Bacon" voltou ao estoque.')).toBeInTheDocument()
  })

  it('reordena opções e grupos com as setas', async () => {
    const { api } = opcoesAdminFalso([ponto(), adicionais()])
    const user = userEvent.setup()
    abrir(api)
    await user.click(await screen.findByRole('button', { name: 'Subir opção Bem passado' }))
    expect(api.reordenarOpcoes).toHaveBeenCalledWith(['o2', 'o1'])

    await user.click(await screen.findByRole('button', { name: 'Subir grupo Adicionais' }))
    expect(api.reordenarGrupos).toHaveBeenCalledWith(['g2', 'g1'])
    await screen.findByRole('button', { name: 'Subir grupo Ponto da carne' })
    expect(nomesDosGrupos()).toEqual(['Adicionais', 'Ponto da carne'])
  })

  it('excluir opção pede confirmação; excluir grupo leva as opções junto', async () => {
    const { api } = opcoesAdminFalso([ponto(), adicionais()])
    const user = userEvent.setup()
    abrir(api)

    await user.click(await screen.findByRole('button', { name: 'Excluir opção Bacon' }))
    expect(api.excluirOpcao).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Excluir de vez' }))
    expect(await screen.findByText('Opção "Bacon" excluída.')).toBeInTheDocument()
    expect(screen.queryByText('Bacon')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Excluir grupo Ponto da carne' }))
    expect(screen.getByText(/Pedidos antigos não mudam/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Excluir de vez' }))
    expect(await screen.findByText('Grupo "Ponto da carne" excluído.')).toBeInTheDocument()
    expect(screen.queryByText('Ao ponto')).not.toBeInTheDocument()
  })

  it('erro do banco ao salvar opção aparece no formulário', async () => {
    const { api, estado } = opcoesAdminFalso([ponto()])
    estado.falhaAoSalvar = 'Sem permissão para alterar.'
    const user = userEvent.setup()
    abrir(api)
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar opção em Ponto da carne' }),
    )
    await user.type(screen.getByLabelText('Nome da opção'), 'X')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão para alterar.')
  })

  it('falha ao carregar: avisa e tenta de novo; link volta à lista', async () => {
    const { api, estado } = opcoesAdminFalso([ponto()], { falhaAoCarregar: true })
    const user = userEvent.setup()
    abrir(api)
    const alerta = await screen.findByRole('alert')
    estado.falhaAoCarregar = false
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Ao ponto')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /Voltar aos produtos/ }))
    expect(screen.getByText('Lista de produtos')).toBeInTheDocument()
  })

  it('acessibilidade (axe): lista e formulário de opção', async () => {
    const { api } = opcoesAdminFalso([ponto(), adicionais()])
    const user = userEvent.setup()
    abrir(api)
    await screen.findByText('Ao ponto')
    const opcoesAxe = {
      runOnly: {
        type: 'tag' as const,
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    }
    const violacoes = async () =>
      (await axe.run(document.body, opcoesAxe)).violations.map(
        (v) => `${v.id}: ${v.help} → ${v.nodes[0]?.html.slice(0, 80)}`,
      )
    expect(await violacoes()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Editar opção Bacon' }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })
})
