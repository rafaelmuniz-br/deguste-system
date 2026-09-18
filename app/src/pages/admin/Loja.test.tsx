import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import type { ApiLojaAdmin } from '../../data/lojaAdminApi.ts'
import type { DadosLoja } from '../../domain/adminLoja.ts'
import Loja from './Loja.tsx'

const dados: DadosLoja = {
  nome: 'Deguste Burguer',
  modo: 'automatico',
  endereco: 'Rua A, 10',
  latitude: -12.9714,
  longitude: -38.5014,
  freteBaseCentavos: 500,
  fretePorKmCentavos: 150,
  raioMaximoKm: 6,
  pedidoMinimoCentavos: 0,
  tempoPreparoMin: 30,
  horarios: [
    { dia: 3, abre: '18:00', fecha: '22:00' },
    { dia: 6, abre: '18:00', fecha: '22:00' },
  ],
}

function apiFalsa(inicial: DadosLoja = dados) {
  const estado = { dados: inicial, falhaAoCarregar: false, falhaAoSalvar: null as string | null }
  const api = {
    carregar: vi.fn(async () => {
      if (estado.falhaAoCarregar) throw new Error('rede')
      return estado.dados
    }),
    salvar: vi.fn(async (d: DadosLoja) => {
      if (estado.falhaAoSalvar) return { ok: false as const, mensagem: estado.falhaAoSalvar }
      estado.dados = d
      return { ok: true as const }
    }),
  }
  return { api: api as ApiLojaAdmin & typeof api, estado }
}

describe('Admin: configurações da loja', () => {
  it('carrega os valores atuais: modo, horários por dia, dinheiro em reais', async () => {
    const { api } = apiFalsa()
    render(<Loja api={api} />)

    expect(await screen.findByLabelText(/Seguir os horários abaixo/)).toBeChecked()
    expect(screen.getByLabelText('Quarta-feira: abre às')).toHaveValue('18:00')
    expect(screen.getByLabelText('Quarta-feira: fecha às')).toHaveValue('22:00')
    expect(
      within(screen.getByRole('group', { name: 'Segunda-feira' })).getByText('Fechado'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Taxa de entrega base (R$)')).toHaveValue('5,00')
    expect(screen.getByLabelText('Valor por km rodado (R$)')).toHaveValue('1,50')
    expect(screen.getByLabelText('Raio máximo de entrega (km)')).toHaveValue('6')
    expect(screen.getByLabelText('Tempo de preparo (minutos)')).toHaveValue('30')
  })

  it('fechar a loja agora: escolhe o modo e salva', async () => {
    const { api } = apiFalsa()
    const user = userEvent.setup()
    render(<Loja api={api} />)

    await user.click(await screen.findByLabelText(/Fechada agora/))
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    expect(await screen.findByText('Configurações salvas.')).toBeInTheDocument()
    expect(api.salvar).toHaveBeenCalledWith(expect.objectContaining({ modo: 'forcar_fechada' }))
  })

  it('edita dinheiro e tempo: envia em centavos e minutos', async () => {
    const { api } = apiFalsa()
    const user = userEvent.setup()
    render(<Loja api={api} />)

    const base = await screen.findByLabelText('Taxa de entrega base (R$)')
    await user.clear(base)
    await user.type(base, '6,5')
    const minimo = screen.getByLabelText('Pedido mínimo (R$)')
    await user.clear(minimo)
    await user.type(minimo, '25')
    const tempo = screen.getByLabelText('Tempo de preparo (minutos)')
    await user.clear(tempo)
    await user.type(tempo, '45')
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    await screen.findByText('Configurações salvas.')
    expect(api.salvar).toHaveBeenCalledWith(
      expect.objectContaining({
        freteBaseCentavos: 650,
        pedidoMinimoCentavos: 2500,
        tempoPreparoMin: 45,
      }),
    )
  })

  it('adiciona um horário num dia fechado e remove outro', async () => {
    const { api } = apiFalsa()
    const user = userEvent.setup()
    render(<Loja api={api} />)

    await user.click(
      await screen.findByRole('button', { name: 'Adicionar horário em Sexta-feira' }),
    )
    expect(screen.getByLabelText('Sexta-feira: abre às')).toHaveValue('18:00')
    await user.click(screen.getByRole('button', { name: /Remover horário de Sábado/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    await screen.findByText('Configurações salvas.')
    const enviado = api.salvar.mock.calls[0][0]
    expect(enviado.horarios).toEqual([
      { dia: 3, abre: '18:00', fecha: '22:00' },
      { dia: 5, abre: '18:00', fecha: '22:00' },
    ])
  })

  it('dois horários no mesmo dia (almoço e jantar)', async () => {
    const { api } = apiFalsa()
    const user = userEvent.setup()
    render(<Loja api={api} />)
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar horário em Quarta-feira' }),
    )
    const abres = screen.getAllByLabelText('Quarta-feira: abre às')
    expect(abres).toHaveLength(2)
  })

  it('horário inválido: mostra o erro, foca o aviso e NÃO chama o banco', async () => {
    const { api } = apiFalsa()
    const user = userEvent.setup()
    render(<Loja api={api} />)

    const fecha = await screen.findByLabelText('Quarta-feira: fecha às')
    await user.clear(fecha)
    await user.type(fecha, '17:00')
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/Quarta-feira.*depois do de abrir/)
    expect(alerta).toHaveFocus()
    expect(api.salvar).not.toHaveBeenCalled()
  })

  it('erro do banco ao salvar: mostra a mensagem e mantém o que foi digitado', async () => {
    const { api, estado } = apiFalsa()
    estado.falhaAoSalvar = 'Sem permissão para alterar. Entre com uma conta de administrador.'
    const user = userEvent.setup()
    render(<Loja api={api} />)
    const tempo = await screen.findByLabelText('Tempo de preparo (minutos)')
    await user.clear(tempo)
    await user.type(tempo, '50')
    await user.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Sem permissão/)
    expect(screen.getByLabelText('Tempo de preparo (minutos)')).toHaveValue('50')
    expect(screen.queryByText('Configurações salvas.')).not.toBeInTheDocument()
  })

  it('falha ao carregar: avisa e permite tentar de novo', async () => {
    const { api, estado } = apiFalsa()
    estado.falhaAoCarregar = true
    const user = userEvent.setup()
    render(<Loja api={api} />)
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/Não foi possível carregar/)
    estado.falhaAoCarregar = false
    await user.click(within(alerta).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByLabelText('Nome da loja')).toHaveValue('Deguste Burguer')
  })

  it('sem endereço e coordenadas: salva como nulos', async () => {
    const { api } = apiFalsa({ ...dados, endereco: null, latitude: null, longitude: null })
    const user = userEvent.setup()
    render(<Loja api={api} />)
    await user.click(await screen.findByRole('button', { name: 'Salvar configurações' }))
    await screen.findByText('Configurações salvas.')
    expect(api.salvar).toHaveBeenCalledWith(
      expect.objectContaining({ endereco: null, latitude: null, longitude: null }),
    )
  })

  it('acessibilidade (axe)', async () => {
    const { api } = apiFalsa()
    render(<Loja api={api} />)
    await screen.findByLabelText('Nome da loja')
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
