import { formatarPreco } from '../domain/dinheiro.ts'
import type { Produto } from '../domain/tipos.ts'

export default function ProdutoCard({
  produto,
  onAbrir,
}: {
  produto: Produto
  onAbrir: (produto: Produto) => void
}) {
  const temOpcoes = produto.grupos.length > 0
  const precoOriginal =
    produto.precoOriginalCentavos !== undefined &&
    produto.precoOriginalCentavos > produto.precoCentavos
      ? produto.precoOriginalCentavos
      : undefined
  const percentualDesconto =
    precoOriginal !== undefined ? Math.round((1 - produto.precoCentavos / precoOriginal) * 100) : 0
  return (
    <li>
      <button
        type="button"
        className="produto-card"
        disabled={!produto.disponivel}
        onClick={() => onAbrir(produto)}
      >
        <span className="produto-texto">
          <span className="produto-nome">
            {produto.nome}
            {produto.ehCombo && <span className="tag">Combo</span>}
            {precoOriginal !== undefined && (
              <span className="tag tag-desconto">-{percentualDesconto}%</span>
            )}
          </span>
          {produto.descricao && <span className="produto-desc">{produto.descricao}</span>}
          <span className="produto-preco">
            {produto.disponivel ? (
              <>
                {precoOriginal !== undefined && (
                  <span className="preco-original">{formatarPreco(precoOriginal)}</span>
                )}
                {temOpcoes && !produto.ehCombo ? 'a partir de ' : ''}
                {formatarPreco(produto.precoCentavos)}
              </>
            ) : (
              <span className="esgotado">Esgotado</span>
            )}
          </span>
        </span>
        {/* Sem foto ainda (tarefa 2.1). Quando houver fotoUrl, usar <img alt="{nome}" loading="lazy">. */}
        {produto.fotoUrl ? (
          <img className="produto-foto" src={produto.fotoUrl} alt={produto.nome} loading="lazy" />
        ) : (
          <span className="produto-foto placeholder" aria-hidden="true">
            🍔
          </span>
        )}
      </button>
    </li>
  )
}
