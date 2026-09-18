import type { SupabaseClient } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import PortaoAdmin from '../components/PortaoAdmin.tsx'
import AuthProvider from '../state/AuthProvider.tsx'
import { useAuth } from '../state/useAuth.ts'
import '../cardapio.css'
import '../admin.css'

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
      <p>
        <Link to="/cozinha">Ir para o painel da cozinha →</Link>
      </p>
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

export default function Admin({ cliente }: { cliente?: SupabaseClient | null }) {
  return (
    <AuthProvider cliente={cliente}>
      <PortaoAdmin titulo="Painel admin">{({ email }) => <Painel email={email} />}</PortaoAdmin>
    </AuthProvider>
  )
}
