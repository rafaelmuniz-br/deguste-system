import { formatarPreco } from '../domain/dinheiro.ts'
import { useCarrinho } from '../state/useCarrinho.ts'
import Modal from './Modal.tsx'
import Quantidade from './Quantidade.tsx'

export default function SacolaModal({
  onFechar,
  lojaAberta,
  pedidoMinimoCentavos,
}: {
  onFechar: () => void
  lojaAberta: boolean
  pedidoMinimoCentavos: number
}) {
  const { linhas, subtotalCentavos, dispatch } = useCarrinho()
  const faltaParaMinimo = Math.max(0, pedidoMinimoCentavos - subtotalCentavos)

  return (
    <Modal
      titulo="Sua sacola"
      onFechar={onFechar}
      rodape={
        linhas.length > 0 ? (
          <>
            <p className="total-linha">
              <span>Subtotal</span> <strong>{formatarPreco(subtotalCentavos)}</strong>
            </p>
            <p className="dica">
              {!lojaAberta
                ? 'A loja está fechada — você poderá finalizar quando abrirmos.'
                : faltaParaMinimo > 0
                  ? `Faltam ${formatarPreco(faltaParaMinimo)} para o pedido mínimo.`
                  : 'Entrega ou retirada, endereço e pagamento no próximo passo.'}
            </p>
            {/* Checkout entra na Fase 3 (pedido, frete e Pix). */}
            <button type="button" className="btn-primario" disabled>
              Finalizar pedido (em breve)
            </button>
          </>
        ) : undefined
      }
    >
      {linhas.length === 0 ? (
        <p className="vazio">Sua sacola está vazia.</p>
      ) : (
        <ul className="lista-sacola">
          {linhas.map((l) => (
            <li key={l.id} className="linha-sacola">
              <div className="linha-info">
                <strong>{l.produto.nome}</strong>
                {l.resumoEscolhas.map((r) => (
                  <span key={r} className="linha-detalhe">
                    {r}
                  </span>
                ))}
                {l.observacao && <span className="linha-detalhe">Obs.: {l.observacao}</span>}
                <span className="linha-preco">{formatarPreco(l.totalCentavos)}</span>
              </div>
              <div className="linha-acoes">
                <Quantidade
                  valor={l.quantidade}
                  nome={l.produto.nome}
                  onChange={(q) => dispatch({ tipo: 'quantidade', id: l.id, quantidade: q })}
                />
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => dispatch({ tipo: 'remover', id: l.id })}
                  aria-label={`Remover ${l.produto.nome} da sacola`}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
