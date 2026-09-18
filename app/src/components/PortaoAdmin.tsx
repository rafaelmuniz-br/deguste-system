import { useEffect, type ReactNode } from 'react'
import Login from '../pages/admin/Login.tsx'
import { useAuth } from '../state/useAuth.ts'

/** Áreas restritas (painel admin e cozinha) não devem aparecer em buscadores. */
function useNaoIndexar() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

/**
 * Porteiro das áreas restritas: só mostra `children` para quem está logado E está na tabela `admins`.
 * Precisa estar dentro de <AuthProvider>. (A proteção real dos dados é o RLS do banco; isto é a tela.)
 */
export default function PortaoAdmin({
  titulo,
  children,
}: {
  titulo: string
  children: (usuario: { email: string }) => ReactNode
}) {
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
          <h1>{titulo}</h1>
          <p role="alert" className="erros">
            O sistema não está conectado ao banco. Confira o arquivo <code>.env.local</code>.
          </p>
        </main>
      )
    case 'deslogado':
      return <Login titulo={titulo} />
    case 'sem_permissao':
      return (
        <main className="admin-login">
          <h1>Sem acesso</h1>
          <p role="alert" className="erros">
            A conta {estado.email} não tem permissão para usar esta área. Peça a um administrador
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
      return <>{children({ email: estado.email })}</>
  }
}
