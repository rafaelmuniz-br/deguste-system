import type { SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import PortaoAdmin from '../components/PortaoAdmin.tsx'
import { criarCatalogoAdminSupabase, type ApiCatalogoAdmin } from '../data/catalogoAdminApi.ts'
import { supabase } from '../lib/supabase.ts'
import AuthProvider from '../state/AuthProvider.tsx'
import { useAuth } from '../state/useAuth.ts'
import Categorias from './admin/Categorias.tsx'
import Produtos from './admin/Produtos.tsx'
import '../cardapio.css'
import '../admin.css'

const EM_CONSTRUCAO = [
  { nome: 'Opções do "monte o seu"', tarefa: '1.10' },
  { nome: 'Fotos', tarefa: '1.11' },
  { nome: 'Configurações da loja', tarefa: '1.12' },
]

function Inicio() {
  return (
    <>
      <p>Escolha o que quer cuidar:</p>
      <ul className="admin-secoes">
        <li>
          <Link to="/admin/categorias">Categorias</Link>
        </li>
        <li>
          <Link to="/admin/produtos">Produtos</Link>{' '}
          <span className="dica">(inclui marcar esgotado)</span>
        </li>
        <li>
          <Link to="/cozinha">Painel da cozinha</Link>
        </li>
      </ul>
      <h2>Em construção</h2>
      <ul className="admin-secoes">
        {EM_CONSTRUCAO.map((s) => (
          <li key={s.tarefa}>
            {s.nome} <span className="dica">tarefa {s.tarefa}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Painel({ email, api }: { email: string; api: ApiCatalogoAdmin | null }) {
  const { sair } = useAuth()
  return (
    <main className="admin admin-largo">
      <header className="admin-topo">
        <div>
          <h1>Painel admin</h1>
          <p className="dica">Logado como {email}</p>
        </div>
        <button type="button" className="btn-secundario" onClick={() => void sair()}>
          Sair
        </button>
      </header>
      <nav aria-label="Seções do painel" className="admin-nav">
        <NavLink to="/admin" end>
          Início
        </NavLink>
        <NavLink to="/admin/categorias">Categorias</NavLink>
        <NavLink to="/admin/produtos">Produtos</NavLink>
        <NavLink to="/cozinha">Cozinha</NavLink>
      </nav>
      <Routes>
        <Route index element={<Inicio />} />
        {api && <Route path="categorias" element={<Categorias api={api} />} />}
        {api && <Route path="produtos" element={<Produtos api={api} />} />}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  )
}

export default function Admin({
  cliente,
  api,
}: {
  cliente?: SupabaseClient | null
  /** Injetável para teste; em produção usa o Supabase. */
  api?: ApiCatalogoAdmin
}) {
  const apiFinal = useMemo(
    () => api ?? (supabase ? criarCatalogoAdminSupabase(supabase) : null),
    [api],
  )
  return (
    <AuthProvider cliente={cliente}>
      <PortaoAdmin titulo="Painel admin">
        {({ email }) => <Painel email={email} api={apiFinal} />}
      </PortaoAdmin>
    </AuthProvider>
  )
}
