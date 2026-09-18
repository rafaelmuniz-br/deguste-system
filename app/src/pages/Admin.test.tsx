import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { catalogoAdminFalso, categoria, produto } from '../test/catalogoAdminFalso.ts'
import { grupo, opcao, opcoesAdminFalso } from '../test/opcoesAdminFalso.ts'
import Admin from './Admin.tsx'

// Supabase FALSO que emite os mesmos eventos do real: INITIAL_SESSION ao assinar, SIGNED_IN/SIGNED_OUT.

type Opcoes = {
  sessao?: { id: string; email: string } | null
  contas?: Record<string, { id: string; senha: string }>
  admins?: string[]
  falhaAoConsultarAdmins?: boolean
  codigoErroLogin?: string
}

function criarClienteFalso(opcoes: Opcoes = {}) {
  let sessao: Session | null = opcoes.sessao
    ? ({ user: { id: opcoes.sessao.id, email: opcoes.sessao.email } } as Session)
    : null
  type Ouvinte = (evento: string, sessao: Session | null) => void
  const ouvintes = new Set<Ouvinte>()
  const emitir = (evento: string) => ouvintes.forEach((o) => o(evento, sessao))

  const signInWithPassword = vi.fn(
    async ({ email, password }: { email: string; password: string }) => {
      const conta = opcoes.contas?.[email]
      if (!conta || conta.senha !== password) {
        return { data: {}, error: { code: opcoes.codigoErroLogin ?? 'invalid_credentials' } }
      }
      sessao = { user: { id: conta.id, email } } as Session
      emitir('SIGNED_IN')
      return { data: { session: sessao }, error: null }
    },
  )
  const signOut = vi.fn(async () => {
    sessao = null
    emitir('SIGNED_OUT')
    return { error: null }
  })

  const cliente = {
    auth: {
      onAuthStateChange(cb: Ouvinte) {
        ouvintes.add(cb)
        queueMicrotask(() => cb('INITIAL_SESSION', sessao))
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(cb) } } }
      },
      signInWithPassword,
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: (_coluna: string, id: string) => ({
          maybeSingle: async () =>
            opcoes.falhaAoConsultarAdmins
              ? { data: null, error: { message: 'rede' } }
              : { data: opcoes.admins?.includes(id) ? { user_id: id } : null, error: null },
        }),
      }),
    }),
  }
  return { cliente: cliente as unknown as SupabaseClient, signInWithPassword, signOut }
}

const contas = {
  'lucas@deguste.com': { id: 'u-lucas', senha: 'senha-certa-1' },
  'visitante@exemplo.com': { id: 'u-visitante', senha: 'outra-senha-2' },
}

async function entrar(user: ReturnType<typeof userEvent.setup>, email: string, senha: string) {
  await user.type(await screen.findByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), senha)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('Painel admin: login', () => {
  it('sem credenciais do banco: avisa em vez de quebrar', async () => {
    render(
      <MemoryRouter>
        <Admin cliente={null} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/não está conectado ao banco/)).toBeInTheDocument()
  })

  it('sem sessão: mostra o formulário de login', async () => {
    const { cliente } = criarClienteFalso()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Painel admin' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })

  it('admin com e-mail e senha corretos entra no painel e pode sair', async () => {
    const { cliente, signOut } = criarClienteFalso({ contas, admins: ['u-lucas'] })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    await entrar(user, 'lucas@deguste.com', 'senha-certa-1')

    expect(await screen.findByText('Logado como lucas@deguste.com')).toBeInTheDocument()
    expect(screen.getByText(/Em construção/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(signOut).toHaveBeenCalledOnce()
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument()
  })

  it('senha errada e e-mail inexistente recebem a MESMA mensagem (não revela quem tem conta)', async () => {
    const { cliente } = criarClienteFalso({ contas, admins: ['u-lucas'] })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )

    await entrar(user, 'lucas@deguste.com', 'errada')
    const primeira = (await screen.findByRole('alert')).textContent

    await user.type(screen.getByLabelText('E-mail'), '{Control>}a{/Control}naoexiste@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), 'qualquer')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    const segunda = (await screen.findByRole('alert')).textContent

    expect(primeira).toBe('E-mail ou senha incorretos.')
    expect(segunda).toBe(primeira)
  })

  it('limpa a senha depois de errar e devolve o foco à mensagem de erro', async () => {
    const { cliente } = criarClienteFalso({ contas })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    await entrar(user, 'lucas@deguste.com', 'errada')
    const alerta = await screen.findByRole('alert')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(alerta).toHaveFocus()
  })

  it('traduz o limite de tentativas do Supabase', async () => {
    const { cliente } = criarClienteFalso({ codigoErroLogin: 'over_request_rate_limit' })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    await entrar(user, 'x@y.com', 'senha')
    expect(await screen.findByText(/Muitas tentativas/)).toBeInTheDocument()
  })
})

describe('Painel admin: quem pode entrar', () => {
  it('usuário logado que NÃO é admin vê "Sem acesso" e nenhum conteúdo do painel', async () => {
    const { cliente } = criarClienteFalso({ contas, admins: ['u-lucas'] })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    await entrar(user, 'visitante@exemplo.com', 'outra-senha-2')

    expect(await screen.findByRole('heading', { name: 'Sem acesso' })).toBeInTheDocument()
    expect(screen.getByText(/visitante@exemplo.com não tem permissão/)).toBeInTheDocument()
    expect(screen.queryByText(/Em construção/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument()
  })

  it('sessão já existente de admin abre o painel direto, sem pedir login', async () => {
    const { cliente } = criarClienteFalso({
      sessao: { id: 'u-lucas', email: 'lucas@deguste.com' },
      admins: ['u-lucas'],
    })
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Logado como lucas@deguste.com')).toBeInTheDocument()
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
  })

  it('não consegue confirmar o acesso (rede): avisa e NÃO libera o painel', async () => {
    const { cliente } = criarClienteFalso({
      sessao: { id: 'u-lucas', email: 'lucas@deguste.com' },
      admins: ['u-lucas'],
      falhaAoConsultarAdmins: true,
    })
    render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Não conseguimos confirmar seu acesso/)).toBeInTheDocument()
    expect(screen.queryByText(/Em construção/)).not.toBeInTheDocument()
  })
})

describe('Painel admin: buscadores', () => {
  it('pede para não ser indexado e remove a marca ao sair da página', async () => {
    const { cliente } = criarClienteFalso()
    const { unmount } = render(
      <MemoryRouter>
        <Admin cliente={cliente} />
      </MemoryRouter>,
    )
    await screen.findByLabelText('E-mail')
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    unmount()
    expect(document.querySelector('meta[name="robots"]')).toBeNull()
  })
})

describe('Painel admin: navegação entre as seções', () => {
  const sessaoAdmin = { sessao: { id: 'u-lucas', email: 'lucas@deguste.com' }, admins: ['u-lucas'] }

  function abrirEm(rota: string, opcoes: Opcoes = sessaoAdmin) {
    const { cliente } = criarClienteFalso(opcoes)
    const { api } = catalogoAdminFalso([categoria()], [produto()])
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/admin/*" element={<Admin cliente={cliente} api={api} />} />
        </Routes>
      </MemoryRouter>,
    )
    return api
  }

  it('o início leva para categorias e produtos, e o menu marca a seção atual', async () => {
    const user = userEvent.setup()
    abrirEm('/admin')
    await screen.findByText('Logado como lucas@deguste.com')

    const menu = screen.getByRole('navigation', { name: 'Seções do painel' })
    await user.click(within(menu).getByRole('link', { name: 'Produtos' }))
    expect(await screen.findByRole('heading', { name: 'Produtos' })).toBeInTheDocument()
    expect(await screen.findByText('Jackfino')).toBeInTheDocument()
    expect(menu.querySelector('[aria-current="page"]')).toHaveTextContent('Produtos')

    await user.click(within(menu).getByRole('link', { name: 'Categorias' }))
    expect(await screen.findByRole('heading', { name: 'Categorias' })).toBeInTheDocument()
  })

  it('endereço direto de uma seção abre a seção (depois do login)', async () => {
    abrirEm('/admin/categorias')
    expect(await screen.findByRole('heading', { name: 'Categorias' })).toBeInTheDocument()
    expect(await screen.findByText('Hambúrgueres')).toBeInTheDocument()
  })

  it('a lista de produtos leva às opções do produto (monte o seu)', async () => {
    const { cliente } = criarClienteFalso(sessaoAdmin)
    const { api } = catalogoAdminFalso([categoria()], [produto()])
    const { api: apiOpcoes } = opcoesAdminFalso([grupo({ opcoes: [opcao({ nome: 'Ao ponto' })] })])
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/produtos']}>
        <Routes>
          <Route
            path="/admin/*"
            element={<Admin cliente={cliente} api={api} apiOpcoes={apiOpcoes} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('link', { name: 'Opções de Jackfino' }))
    expect(await screen.findByText('Ao ponto')).toBeInTheDocument()
    expect(apiOpcoes.carregar).toHaveBeenCalledWith('p1')
  })

  it('endereço que não existe volta ao início', async () => {
    abrirEm('/admin/qualquer-coisa')
    expect(await screen.findByText(/Escolha o que quer cuidar/)).toBeInTheDocument()
  })

  it('quem não é admin NÃO carrega categorias nem produtos', async () => {
    const api = abrirEm('/admin/produtos', {
      sessao: { id: 'u-visitante', email: 'visitante@exemplo.com' },
      admins: [],
    })
    expect(await screen.findByRole('heading', { name: 'Sem acesso' })).toBeInTheDocument()
    expect(api.listarProdutos).not.toHaveBeenCalled()
  })
})
