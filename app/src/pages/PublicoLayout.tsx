import { Outlet } from 'react-router-dom'
import AvisoCookies from '../components/AvisoCookies.tsx'
import RodapeLoja from '../components/RodapeLoja.tsx'
import '../cardapio.css'
import '../legal.css'

/** Moldura das páginas para o público (cardápio, pedido e páginas legais). O /admin não usa. */
export default function PublicoLayout() {
  return (
    <>
      <AvisoCookies />
      <Outlet />
      <RodapeLoja />
    </>
  )
}
