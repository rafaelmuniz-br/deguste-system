/** Mostra o valor, ou "[a definir]" em destaque quando o negócio ainda não decidiu. */
export default function Pendente({ valor }: { valor: string | null | undefined }) {
  if (valor) return <>{valor}</>
  return <mark className="pendente">[a definir]</mark>
}

/** Marca um trecho que precisa de revisão jurídica ou decisão antes de publicar. */
export function Revisar({ children }: { children: string }) {
  return (
    <mark className="pendente" title="Precisa de revisão antes de publicar">
      [revisar: {children}]
    </mark>
  )
}
