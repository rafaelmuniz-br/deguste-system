import { Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin.tsx'
import Cardapio from './pages/Cardapio.tsx'
import Checkout from './pages/Checkout.tsx'
import Cozinha from './pages/Cozinha.tsx'
import LojaLayout from './pages/LojaLayout.tsx'

export default function App() {
  return (
    <Routes>
      {/* Páginas do cliente: compartilham cardápio, sacola e API de pedidos. */}
      <Route element={<LojaLayout />}>
        <Route path="/" element={<Cardapio />} />
        <Route path="/pedido" element={<Checkout />} />
      </Route>
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/cozinha" element={<Cozinha />} />
    </Routes>
  )
}
