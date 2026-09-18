import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect } from 'react'
import AuthProvider from '../state/AuthProvider.tsx'
import { useAuth } from '../state/useAuth.ts'
import Login from './admin/Login.tsx'
import '../cardapio.css'
import '../admin.css'

/** O painel não deve aparecer em buscadores. */
function useNaoIndexar() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

const SECOES = [
  { nome: 'Categorias', tarefa: '1.8' },
  { nome: 'Produtos', tarefa: '1.9' },
  { nome: 'Opções do "monte o seu"', tarefa: '1.10' },
  { nome: 'Fotos', tarefa: '1.11' },
  { nome: 'Configurações da loja', tarefa: '1.12' },
]

function Painel({ email }: { email: string }) {
  const { sair } = useAuth()
  return (
    <main className="admin">
      <header className="admin-topo">
        <div>
          <h1>Painel admin</h1>
          <p className="dica">Logado como {email}</p>
        </div>
        <button type="button" className="btn-secundario" onClick={() => void sair()}>
          Sair
        </button>
      </header>
      <h2>Em construção</h2>
      <ul className="admin-secoes">
        {SECOES.map((s) => (
          <li key={s.tarefa}>
            {s.nome} <span className="dica">tarefa {s.tarefa}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}

function Porteiro() {
  const { estado, sair } = useAuth()
  useNaoIndexar()

  switch (estado.tipo) {
    case 'carregando':
      return (
        <main className="admin-login">
          <p role="status">Verificando acesso…</p>
        </main>
      )
    case 'sem_banco':
      return (
        <main className="admin-login">
          <h1>Painel admin</h1>
          <p role="alert" className="erros">
            O sistema não está conectado ao banco. Confira o arquivo <code>.env.local</code>.
          </p>
        </main>
      )
    case 'deslogado':
      return <Login />
    case 'sem_permissao':
      return (
        <main className="admin-login">
          <h1>Sem acesso</h1>
          <p role="alert" className="erros">
            A conta {estado.email} não tem permissão para usar o painel. Peça a um administrador
            para liberar o seu acesso.
          </p>
          <button type="button" className="btn-secundario" onClick={() => void sair()}>
            Sair
          </button>
        </main>
      )
    case 'erro':
      return (
        <main className="admin-login">
          <p role="alert" className="erros">
            {estado.mensagem}
          </p>
          <button type="button" className="btn-secundario" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </main>
      )
    case 'admin':
      return <Painel email={estado.email} />
  }
}

export default function Admin({ cliente }: { cliente?: SupabaseClient | null }) {
  return (
    <AuthProvider cliente={cliente}>
      <Porteiro />
    </AuthProvider>
  )
}
