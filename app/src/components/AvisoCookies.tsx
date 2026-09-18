import { useState } from 'react'
import { Link } from 'react-router-dom'

const CHAVE = 'deguste:aviso-cookies:v1'

function jaVisto(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Aviso INFORMATIVO sobre armazenamento no navegador. Hoje o site só guarda a sacola do cliente
 * (armazenamento essencial) e NÃO usa cookies de publicidade, estatística nem de terceiros, então
 * não há o que aceitar ou recusar.
 *
 * SE um dia entrar analytics, pixel ou qualquer cookie não essencial, este componente precisa virar
 * pedido de CONSENTIMENTO (com botões "Aceitar" e "Recusar" de mesmo destaque) e nada disso pode ser
 * gravado antes do aceite. Ver docs/paginas-legais.md.
 */
export default function AvisoCookies() {
  const [visivel, setVisivel] = useState(() => !jaVisto())
  if (!visivel) return null

  function entendi() {
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {
      // sem armazenamento: o aviso volta na próxima visita, sem problema
    }
    setVisivel(false)
  }

  return (
    <aside className="aviso-cookies" aria-label="Aviso sobre cookies e armazenamento">
      <p>
        Este site guarda no seu navegador apenas o essencial para funcionar (como a sua sacola). Não
        usamos cookies de publicidade nem de terceiros.{' '}
        <Link to="/privacidade#cookies">Saiba mais</Link>
      </p>
      <button type="button" className="btn-secundario" onClick={entendi}>
        Entendi
      </button>
    </aside>
  )
}
