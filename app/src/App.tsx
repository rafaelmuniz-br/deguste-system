import { Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin.tsx'
import Cardapio from './pages/Cardapio.tsx'
import Checkout from './pages/Checkout.tsx'
import Cozinha from './pages/Cozinha.tsx'
import Cancelamento from './pages/legal/Cancelamento.tsx'
import Faq from './pages/legal/Faq.tsx'
import Privacidade from './pages/legal/Privacidade.tsx'
import Termos from './pages/legal/Termos.tsx'
import LojaLayout from './pages/LojaLayout.tsx'
import PublicoLayout from './pages/PublicoLayout.tsx'

export default function App() {
  return (
    <Routes>
      {/* Páginas para o público: rodapé com links legais e aviso de cookies. */}
      <Route element={<PublicoLayout />}>
        {/* Cardápio e pedido: compartilham cardápio, sacola e API de pedidos. */}
        <Route element={<LojaLayout />}>
          <Route path="/" element={<Cardapio />} />
          <Route path="/pedido" element={<Checkout />} />
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
  )
}
