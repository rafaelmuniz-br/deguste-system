import { Route, Routes } from 'react-router-dom'
import Admin from './pages/Admin.tsx'
import Cardapio from './pages/Cardapio.tsx'
import Cozinha from './pages/Cozinha.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cardapio />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/cozinha" element={<Cozinha />} />
    </Routes>
  )
}
