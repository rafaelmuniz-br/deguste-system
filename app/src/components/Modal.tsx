import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Diálogo acessível: foco preso dentro, Esc fecha, devolve o foco ao fechar, trava o scroll do fundo. */
export default function Modal({
  titulo,
  onFechar,
  children,
  rodape,
}: {
  titulo: string
  onFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.body.style.overflow = overflowAnterior
      anterior?.focus?.()
    }
  }, [])

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onFechar()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const itens = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCAVEIS))
    if (itens.length === 0) return
    const primeiro = itens[0]
    const ultimo = itens[itens.length - 1]
    if (
      e.shiftKey &&
      (document.activeElement === primeiro || document.activeElement === ref.current)
    ) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  return (
    <div
      className="modal-fundo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={aoTeclar}
      >
        <div className="modal-topo">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="btn-icone" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  )
}
