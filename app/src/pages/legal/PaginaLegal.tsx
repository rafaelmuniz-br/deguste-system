import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CONTEUDO_LEGAL_REVISADO, LEGAL_ATUALIZADO_EM, NEGOCIO } from '../../config/negocio.ts'

/** Moldura comum das páginas legais: título, aviso de rascunho (enquanto não revisado) e data. */
export default function PaginaLegal({
  titulo,
  children,
  mostrarData = true,
}: {
  titulo: string
  children: ReactNode
  mostrarData?: boolean
}) {
  useEffect(() => {
    const anterior = document.title
    document.title = `${titulo} · ${NEGOCIO.nome}`
    return () => {
      document.title = anterior
    }
  }, [titulo])

  return (
    <main className="pagina legal">
      <p>
        <Link to="/">← Voltar ao cardápio</Link>
      </p>
      <h1>{titulo}</h1>
      {!CONTEUDO_LEGAL_REVISADO && (
        <p className="aviso-rascunho" role="note">
          <strong>Rascunho em revisão.</strong> Este texto descreve como o sistema funciona, mas
          ainda não foi revisado por um profissional jurídico. Os trechos{' '}
          <mark className="pendente">[em amarelo]</mark> dependem de decisão da loja.
        </p>
      )}
      {mostrarData && <p className="dica">Última atualização: {LEGAL_ATUALIZADO_EM}</p>}
      {children}
    </main>
  )
}
