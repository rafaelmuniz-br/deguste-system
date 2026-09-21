import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Cardapio from './pages/Cardapio.tsx'
import LojaLayout from './pages/LojaLayout.tsx'
import PublicoLayout from './pages/PublicoLayout.tsx'

// Só o cardápio (a primeira tela do cliente) vem no pacote principal. O resto é baixado quando a
// pessoa chega lá: o cliente no celular não baixa o painel admin nem a cozinha, e o admin não
// baixa as páginas legais. (Tarefa 2.9: carregar rápido em 4G.)
const Checkout = lazy(() => import('./pages/Checkout.tsx'))
const Acompanhar = lazy(() => import('./pages/Acompanhar.tsx'))
const Admin = lazy(() => import('./pages/Admin.tsx'))
const Cozinha = lazy(() => import('./pages/Cozinha.tsx'))
const Cancelamento = lazy(() => import('./pages/legal/Cancelamento.tsx'))
const Faq = lazy(() => import('./pages/legal/Faq.tsx'))
const Privacidade = lazy(() => import('./pages/legal/Privacidade.tsx'))
const Termos = lazy(() => import('./pages/legal/Termos.tsx'))

function Carregando() {
  return (
    <p role="status" className="carregando-pagina">
      Carregando…
    </p>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Routes>
        {/* Páginas para o público: rodapé com links legais e aviso de cookies. */}
        <Route element={<PublicoLayout />}>
          {/* Cardápio e pedido: compartilham cardápio, sacola e API de pedidos. */}
          <Route element={<LojaLayout />}>
            <Route path="/" element={<Cardapio />} />
            <Route path="/pedido" element={<Checkout />} />
            <Route path="/acompanhar/:token" element={<Acompanhar />} />
          </Route>
          {/* Páginas legais: estáticas, funcionam mesmo se o banco estiver fora do ar. */}
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/cancelamento" element={<Cancelamento />} />
          <Route path="/faq" element={<Faq />} />
        </Route>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/cozinha" element={<Cozinha />} />
      </Routes>
    </Suspense>
  )
}
