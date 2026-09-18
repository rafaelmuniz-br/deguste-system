import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiCozinha, ConexaoTempoReal, ProblemaImpressao } from '../data/cozinhaApi.ts'
import type { PedidoCozinha } from '../domain/cozinha.ts'
import Cozinha from './Cozinha.tsx'

// Cliente do Supabase falso só para a porta do admin (a cozinha em si usa a ApiCozinha falsa abaixo).
function clienteAdmin(admin: boolean) {
  const id = 'u-admin'
  const sessao = { user: { id, email: 'lucas@deguste.com' } } as Session
  const cliente = {
    auth: {
      onAuthStateChange(cb: (e: string, s: Session | null) => void) {
        queueMicrotask(() => cb('INITIAL_SESSION', sessao))
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: admin ? { user_id: id } : null, error: null }),
        }),
      }),
    }),
  }
  return cliente as unknown as SupabaseClient
}

const agoraIso = (minutosAtras: number) =>
  new Date(Date.now() - minutosAtras * 60_000).toISOString()

function pedido(extra: Partial<PedidoCozinha> = {}): PedidoCozinha {
  return {
    id: 'p1',
    numero: 101,
    criadoEm: agoraIso(2),
    canal: 'proprio',
    tipo: 'entrega',
    status: 'novo',
    clienteNome: 'Maria Silva',
    clienteTelefone: '71999998888',
    endereco: { rua: 'Rua das Flores', numero: '10', bairro: 'Pituba', referencia: 'Portão azul' },
    totalCentavos: 4290,
    itens: [
      {
        nome: 'Combo Casal',
        quantidade: 1,
        observacoes: 'sem cebola',
        componentes: [{ grupo: 'Burger', opcao: 'Smash Bacon', quantidade: 2 }],
      },
    ],
    ...extra,
  }
}

type Falha = { listar?: boolean }

function apiFalsa(inicial: PedidoCozinha[], problemas: ProblemaImpressao[] = []) {
  const estado = { pedidos: inicial, problemas, falha: {} as Falha }
  let aoMudar: () => void = () => {}
  let aoConexao: (c: ConexaoTempoReal) => void = () => {}
  const api = {
    listar: vi.fn(async () => {
      if (estado.falha.listar) throw new Error('rede')
      return estado.pedidos
    }),
    mudarStatus: vi.fn<ApiCozinha['mudarStatus']>(async () => ({ ok: true })),
    reimprimir: vi.fn(async () => true),
    problemasImpressao: vi.fn(async () => estado.problemas),
    assinar: vi.fn((mudou: () => void, conexao: (c: ConexaoTempoReal) => void) => {
      aoMudar = mudou
      aoConexao = conexao
      return () => {}
    }),
  }
  return {
    api: api as unknown as ApiCozinha & typeof api,
    estado,
    dispararEvento: () => aoMudar(),
    conexao: (c: ConexaoTempoReal) => aoConexao(c),
  }
}

function abrir(f: ReturnType<typeof apiFalsa>, admin = true) {
  return render(
    <MemoryRouter>
      <Cozinha cliente={clienteAdmin(admin)} api={f.api} />
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('Cozinha: acesso', () => {
  it('quem não é admin não vê nenhum pedido', async () => {
    const f = apiFalsa([pedido()])
    abrir(f, false)
    expect(await screen.findByRole('heading', { name: 'Sem acesso' })).toBeInTheDocument()
    expect(screen.queryByText(/Maria Silva/)).not.toBeInTheDocument()
    expect(f.api.listar).not.toHaveBeenCalled()
  })
})

describe('Cozinha: quadro de pedidos', () => {
  it('coloca cada pedido na coluna do seu status, com itens, escolhas e observações em destaque', async () => {
    const f = apiFalsa([
      pedido(),
      pedido({ id: 'p2', numero: 102, status: 'em_preparo', observacoes: 'campainha quebrada' }),
      pedido({ id: 'p3', numero: 103, status: 'saiu_para_entrega' }),
    ])
    abrir(f)

    const novos = await screen.findByRole('region', { name: 'Novos' })
    expect(within(novos).getByText('Pedido 101')).toBeInTheDocument()
    expect(within(novos).getByText('1× Combo Casal')).toBeInTheDocument()
    expect(within(novos).getByText('Burger: 2× Smash Bacon')).toBeInTheDocument()
    expect(within(novos).getByText('⚠ sem cebola')).toBeInTheDocument()

    const preparo = screen.getByRole('region', { name: 'Em preparo' })
    expect(within(preparo).getByText('Pedido 102')).toBeInTheDocument()
    expect(within(preparo).getByText('⚠ Pedido: campainha quebrada')).toBeInTheDocument()

    const prontos = screen.getByRole('region', { name: 'Prontos / a caminho' })
    expect(within(prontos).getByText('Pedido 103')).toBeInTheDocument()
  })

  it('entrega mostra endereço, telefone e link de rota; retirada não tem rota', async () => {
    const f = apiFalsa([
      pedido(),
      pedido({ id: 'p2', numero: 102, tipo: 'retirada', endereco: undefined }),
    ])
    abrir(f)
    await screen.findByText('Pedido 101')

    const rotas = screen.getAllByRole('link', { name: 'Rota no mapa' })
    expect(rotas).toHaveLength(1)
    expect(rotas[0]).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir'))
    expect(screen.getByText(/Rua das Flores, 10 — Pituba/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /\(71\) 9/ })[0]).toHaveAttribute(
      'href',
      'tel:+5571999998888',
    )
  })

  it('pedido de marketplace mostra a etiqueta do canal', async () => {
    abrir(apiFalsa([pedido({ canal: 'ifood' })]))
    expect(await screen.findByText('iFood')).toBeInTheDocument()
  })

  it('pedido além do tempo prometido aparece como ATRASADO', async () => {
    abrir(apiFalsa([pedido({ criadoEm: agoraIso(45) })]))
    expect(await screen.findByText(/ATRASADO/)).toBeInTheDocument()
  })

  it('sem pedidos: cada coluna diz que está vazia', async () => {
    abrir(apiFalsa([]))
    await screen.findByRole('region', { name: 'Novos' })
    expect(screen.getAllByText('Nenhum pedido.')).toHaveLength(3)
  })
})

describe('Cozinha: mudar status', () => {
  it('o botão principal avança exatamente uma etapa e recarrega a tela', async () => {
    const f = apiFalsa([pedido()])
    const user = userEvent.setup()
    abrir(f)

    await user.click(await screen.findByRole('button', { name: 'Aceitar e preparar' }))

    expect(f.api.mudarStatus).toHaveBeenCalledWith('p1', 'novo', 'em_preparo', undefined)
    await waitFor(() => expect(f.api.listar).toHaveBeenCalledTimes(2))
  })

  it('entrega pronta pergunta "Saiu para entrega"; retirada pronta, "Entregue ao cliente"', async () => {
    const f = apiFalsa([
      pedido({ status: 'pronto' }),
      pedido({ id: 'p2', numero: 102, status: 'pronto', tipo: 'retirada', endereco: undefined }),
    ])
    abrir(f)
    expect(await screen.findByRole('button', { name: 'Saiu para entrega' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entregue ao cliente' })).toBeInTheDocument()
  })

  it('quando outra pessoa já mexeu no pedido: avisa e atualiza a tela', async () => {
    const f = apiFalsa([pedido()])
    f.api.mudarStatus.mockResolvedValueOnce({ ok: false, motivo: 'conflito' })
    const user = userEvent.setup()
    abrir(f)

    await user.click(await screen.findByRole('button', { name: 'Aceitar e preparar' }))

    expect(await screen.findByText(/já foi alterado por outra pessoa/)).toBeInTheDocument()
    await waitFor(() => expect(f.api.listar).toHaveBeenCalledTimes(2))
  })

  it('erro ao salvar: avisa para tentar de novo', async () => {
    const f = apiFalsa([pedido()])
    f.api.mudarStatus.mockResolvedValueOnce({ ok: false, motivo: 'erro' })
    const user = userEvent.setup()
    abrir(f)
    await user.click(await screen.findByRole('button', { name: 'Aceitar e preparar' }))
    expect(await screen.findByText(/Não consegui atualizar o pedido 101/)).toBeInTheDocument()
  })
})

describe('Cozinha: cancelar e recusar', () => {
  it('pedido novo oferece "Recusar"; exige um motivo antes de confirmar e o envia junto', async () => {
    const f = apiFalsa([pedido()])
    const user = userEvent.setup()
    abrir(f)

    await user.click(await screen.findByRole('button', { name: 'Recusar' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar' })
    expect(confirmar).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo'), 'sem estoque de pão')
    expect(confirmar).toBeEnabled()
    await user.click(confirmar)

    expect(f.api.mudarStatus).toHaveBeenCalledWith('p1', 'novo', 'cancelado', 'sem estoque de pão')
  })

  it('pedido em preparo oferece "Cancelar"; "Voltar" fecha sem cancelar', async () => {
    const f = apiFalsa([pedido({ status: 'em_preparo' })])
    const user = userEvent.setup()
    abrir(f)

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(f.api.mudarStatus).not.toHaveBeenCalled()
  })
})

describe('Cozinha: impressão', () => {
  it('reimprimir um pedido chama o banco e confirma', async () => {
    const f = apiFalsa([pedido()])
    const user = userEvent.setup()
    abrir(f)
    await user.click(await screen.findByRole('button', { name: 'Reimprimir' }))
    expect(f.api.reimprimir).toHaveBeenCalledWith('p1')
    expect(await screen.findByText('Pedido 101 enviado para reimpressão.')).toBeInTheDocument()
  })

  it('pedido que não saiu impresso aparece em alerta, com atalho para reimprimir', async () => {
    const f = apiFalsa([pedido()], [{ numero: 101, status: 'falhou', erro: 'sem papel' }])
    const user = userEvent.setup()
    abrir(f)

    const alerta = await screen.findByRole('alert', { name: 'Problemas de impressão' })
    expect(within(alerta).getByText(/1 pedido não saiu impresso/)).toBeInTheDocument()
    expect(within(alerta).getByText(/sem papel/)).toBeInTheDocument()

    await user.click(within(alerta).getByRole('button', { name: 'Reimprimir' }))
    expect(f.api.reimprimir).toHaveBeenCalledWith('p1')
  })

  it('falha ao reimprimir avisa', async () => {
    const f = apiFalsa([pedido()])
    f.api.reimprimir.mockResolvedValueOnce(false)
    const user = userEvent.setup()
    abrir(f)
    await user.click(await screen.findByRole('button', { name: 'Reimprimir' }))
    expect(await screen.findByText('Não consegui reimprimir o pedido 101.')).toBeInTheDocument()
  })
})

describe('Cozinha: conexão e tempo real', () => {
  it('mostra o estado do tempo real e avisa claramente quando cai', async () => {
    const f = apiFalsa([])
    abrir(f)
    await screen.findByRole('region', { name: 'Novos' })
    expect(screen.getByText('Conectando…')).toBeInTheDocument()

    f.conexao('conectado')
    expect(await screen.findByText('● Tempo real conectado')).toBeInTheDocument()

    f.conexao('desconectado')
    expect(await screen.findByText(/Sem tempo real: atualizando a cada 15 s/)).toBeInTheDocument()
  })

  it('evento do tempo real recarrega os pedidos (vários eventos seguidos = uma consulta)', async () => {
    const f = apiFalsa([])
    abrir(f)
    await screen.findByRole('region', { name: 'Novos' })
    expect(f.api.listar).toHaveBeenCalledTimes(1)

    f.estado.pedidos = [pedido({ numero: 555, id: 'novo1' })]
    f.dispararEvento()
    f.dispararEvento()
    f.dispararEvento()

    expect(await screen.findByText('Pedido 555')).toBeInTheDocument()
    expect(f.api.listar).toHaveBeenCalledTimes(2)
  })

  it('falha ao consultar: mantém os pedidos na tela e avisa que podem estar desatualizados', async () => {
    const f = apiFalsa([pedido()])
    abrir(f)
    await screen.findByText('Pedido 101')

    f.estado.falha.listar = true
    f.dispararEvento()

    expect(await screen.findByText(/pode estar desatualizado/)).toBeInTheDocument()
    expect(screen.getByText('Pedido 101')).toBeInTheDocument()
  })

  it('primeira consulta falha: não fica "carregando" para sempre', async () => {
    const f = apiFalsa([])
    f.estado.falha.listar = true
    abrir(f)
    expect(await screen.findByText(/Não conseguimos atualizar os pedidos/)).toBeInTheDocument()
    expect(screen.queryByText('Carregando pedidos…')).not.toBeInTheDocument()
  })
})

describe('Cozinha: som', () => {
  it('ativar o som lembra a escolha e toca um bipe de teste', async () => {
    const criados: unknown[] = []
    class ContextoFalso {
      currentTime = 0
      destination = {}
      resume = vi.fn()
      constructor() {
        criados.push(this)
      }
      createOscillator = () => ({
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn() })
    }
    vi.stubGlobal('AudioContext', ContextoFalso)

    const user = userEvent.setup()
    abrir(apiFalsa([]))
    const botao = await screen.findByRole('button', { name: /Ativar som/ })
    expect(botao).toHaveAttribute('aria-pressed', 'false')

    await user.click(botao)

    expect(screen.getByRole('button', { name: /Som ligado/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(localStorage.getItem('deguste:cozinha:som')).toBe('1')
    expect(criados.length).toBeGreaterThan(0)
  })

  it('aparelho sem áudio: avisa e mantém o aviso visual', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const user = userEvent.setup()
    abrir(apiFalsa([]))
    await user.click(await screen.findByRole('button', { name: /Ativar som/ }))
    expect(await screen.findByText(/não conseguiu tocar som/)).toBeInTheDocument()
  })

  it('lembra que o som estava ligado na próxima vez', async () => {
    localStorage.setItem('deguste:cozinha:som', '1')
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0
        destination = {}
        resume = vi.fn()
        createOscillator = () => ({
          type: '',
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        })
        createGain = () => ({ gain: { value: 0 }, connect: vi.fn() })
      },
    )
    abrir(apiFalsa([]))
    expect(await screen.findByRole('button', { name: /Som ligado/ })).toBeInTheDocument()
  })
})

describe('Cozinha: acessibilidade (axe-core; o contraste tem teste próprio em contraste.test.ts)', () => {
  async function violacoes() {
    const r = await axe.run(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: { 'color-contrast': { enabled: false } },
    })
    return r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes[0]?.html.slice(0, 90)}`)
  }

  it('quadro com pedidos, alerta de impressão e aviso', async () => {
    const f = apiFalsa(
      [
        pedido(),
        pedido({ id: 'p2', numero: 102, status: 'em_preparo', criadoEm: agoraIso(45) }),
        pedido({ id: 'p3', numero: 103, status: 'pronto', tipo: 'retirada', endereco: undefined }),
      ],
      [{ numero: 101, status: 'falhou', erro: 'sem papel' }],
    )
    abrir(f)
    await screen.findByText('Pedido 101')
    expect(await violacoes()).toEqual([])
  })

  it('diálogo de cancelamento', async () => {
    const user = userEvent.setup()
    abrir(apiFalsa([pedido()]))
    await user.click(await screen.findByRole('button', { name: 'Recusar' }))
    await screen.findByRole('dialog')
    expect(await violacoes()).toEqual([])
  })
})
