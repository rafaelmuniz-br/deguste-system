import { QUANTIDADE_MAXIMA } from '../domain/carrinho.ts'

export default function Quantidade({
  valor,
  onChange,
  nome,
  minimo = 1,
  maximo = QUANTIDADE_MAXIMA,
}: {
  valor: number
  onChange: (novo: number) => void
  /** Nome do item, para leitores de tela ("Diminuir quantidade de Jackfino"). */
  nome: string
  minimo?: number
  maximo?: number
}) {
  return (
    <div className="quantidade" role="group" aria-label={`Quantidade de ${nome}`}>
      <button
        type="button"
        className="btn-icone"
        aria-label={`Diminuir quantidade de ${nome}`}
        disabled={valor <= minimo}
        onClick={() => onChange(valor - 1)}
      >
        −
      </button>
      <output aria-live="polite">{valor}</output>
      <button
        type="button"
        className="btn-icone"
        aria-label={`Aumentar quantidade de ${nome}`}
        disabled={valor >= maximo}
        onClick={() => onChange(valor + 1)}
      >
        +
      </button>
    </div>
  )
}
