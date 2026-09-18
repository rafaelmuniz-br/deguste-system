import type { SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import PortaoAdmin from '../components/PortaoAdmin.tsx'
import { criarCatalogoAdminSupabase, type ApiCatalogoAdmin } from '../data/catalogoAdminApi.ts'
import { criarFotosAdminSupabase, type ApiFotosAdmin } from '../data/fotosAdminApi.ts'
import { criarOpcoesAdminSupabase, type ApiOpcoesAdmin } from '../data/opcoesAdminApi.ts'
import { criarLojaAdminSupabase, type ApiLojaAdmin } from '../data/lojaAdminApi.ts'
import { supabase } from '../lib/supabase.ts'
import AuthProvider from '../state/AuthProvider.tsx'
import { useAuth } from '../state/useAuth.ts'
import Categorias from './admin/Categorias.tsx'
import Loja from './admin/Loja.tsx'
import OpcoesProduto from './admin/OpcoesProduto.tsx'
import Produtos from './admin/Produtos.tsx'
import '../cardapio.css'
import '../admin.css'

const EM_CONSTRUCAO = [{ nome: 'Fotos', tarefa: '1.11' }]

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
          <span className="dica">(inclui as opções do “monte o seu” e marcar esgotado)</span>
        </li>
        <li>
          <Link to="/admin/loja">Configurações da loja</Link>{' '}
          <span className="dica">(horários, abrir/fechar, entrega)</span>
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

function Painel({
  email,
  api,
  apiLoja,
  apiOpcoes,
  apiFotos,
}: {
  email: string
  api: ApiCatalogoAdmin | null
  apiLoja: ApiLojaAdmin | null
  apiOpcoes: ApiOpcoesAdmin | null
  apiFotos: ApiFotosAdmin | null
}) {
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
        <NavLink to="/admin/loja">Loja</NavLink>
        <NavLink to="/cozinha">Cozinha</NavLink>
      </nav>
      <Routes>
        <Route index element={<Inicio />} />
        {api && <Route path="categorias" element={<Categorias api={api} />} />}
        {api && (
          <Route path="produtos" element={<Produtos api={api} fotos={apiFotos ?? undefined} />} />
        )}
        {apiOpcoes && (
          <Route path="produtos/:id/opcoes" element={<OpcoesProduto api={apiOpcoes} />} />
        )}
        {apiLoja && <Route path="loja" element={<Loja api={apiLoja} />} />}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  )
}

export default function Admin({
  cliente,
  api,
  apiLoja,
  apiOpcoes,
  apiFotos,
}: {
  cliente?: SupabaseClient | null
  /** Injetáveis para teste; em produção usam o Supabase. */
  api?: ApiCatalogoAdmin
  apiLoja?: ApiLojaAdmin
  apiOpcoes?: ApiOpcoesAdmin
  apiFotos?: ApiFotosAdmin
}) {
  const apiFinal = useMemo(
    () => api ?? (supabase ? criarCatalogoAdminSupabase(supabase) : null),
    [api],
  )
  const apiLojaFinal = useMemo(
    () => apiLoja ?? (supabase ? criarLojaAdminSupabase(supabase) : null),
    [apiLoja],
  )
  const apiOpcoesFinal = useMemo(
    () => apiOpcoes ?? (supabase ? criarOpcoesAdminSupabase(supabase) : null),
    [apiOpcoes],
  )
  const apiFotosFinal = useMemo(
    () => apiFotos ?? (supabase ? criarFotosAdminSupabase(supabase) : null),
    [apiFotos],
  )
  return (
    <AuthProvider cliente={cliente}>
      <PortaoAdmin titulo="Painel admin">
        {({ email }) => (
          <Painel
            email={email}
            api={apiFinal}
            apiLoja={apiLojaFinal}
            apiOpcoes={apiOpcoesFinal}
            apiFotos={apiFotosFinal}
          />
        )}
      </PortaoAdmin>
    </AuthProvider>
  )
}
