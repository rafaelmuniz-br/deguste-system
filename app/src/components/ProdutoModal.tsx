import { useId, useState } from 'react'
import {
  mensagemGrupo,
  precoUnitario,
  validarEscolhas,
  type Escolhas,
  type LinhaCarrinho,
} from '../domain/carrinho.ts'
import { formatarPreco } from '../domain/dinheiro.ts'
import { novoId } from '../domain/id.ts'
import type { GrupoOpcao, Produto } from '../domain/tipos.ts'
import Modal from './Modal.tsx'
import Quantidade from './Quantidade.tsx'

export default function ProdutoModal({
  produto,
  lojaAberta,
  onFechar,
  onAdicionar,
}: {
  produto: Produto
  lojaAberta: boolean
  onFechar: () => void
  onAdicionar: (linha: LinhaCarrinho) => void
}) {
  const [escolhas, setEscolhas] = useState<Escolhas>({})
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const idDica = useId()

  const erros = validarEscolhas(produto, escolhas)
  const total = precoUnitario(produto, escolhas) * quantidade
  const podeAdicionar = lojaAberta && erros.length === 0

  function alternar(grupo: GrupoOpcao, opcaoId: string) {
    setEscolhas((atual) => {
      const marcadas = atual[grupo.id] ?? []
      let novas: string[]
      if (marcadas.includes(opcaoId)) {
        novas = marcadas.filter((id) => id !== opcaoId)
        // Grupo de escolha obrigatória única (radio): clicar de novo não desmarca.
        if (grupo.minEscolhas === 1 && grupo.maxEscolhas === 1) novas = marcadas
      } else if (grupo.maxEscolhas === 1) {
        novas = [opcaoId]
      } else if (marcadas.length < grupo.maxEscolhas) {
        novas = [...marcadas, opcaoId]
      } else {
        novas = marcadas
      }
      return { ...atual, [grupo.id]: novas }
    })
  }

  function adicionar() {
    onAdicionar({
      id: novoId(),
      produtoId: produto.id,
      quantidade,
      escolhas,
      observacao: observacao.trim(),
    })
  }

  return (
    <Modal
      titulo={produto.nome}
      onFechar={onFechar}
      rodape={
        <>
          <p id={idDica} className="dica" aria-live="polite">
            {!lojaAberta
              ? 'A loja está fechada — não é possível adicionar à sacola agora.'
              : (erros[0] ?? '')}
          </p>
          <div className="rodape-acoes">
            <Quantidade valor={quantidade} onChange={setQuantidade} nome={produto.nome} />
            <button
              type="button"
              className="btn-primario"
              disabled={!podeAdicionar}
              aria-describedby={idDica}
              onClick={adicionar}
            >
              Adicionar · {formatarPreco(total)}
            </button>
          </div>
        </>
      }
    >
      {produto.descricao && <p className="modal-desc">{produto.descricao}</p>}
      <p className="modal-preco">{formatarPreco(produto.precoCentavos)}</p>

      {produto.grupos.map((grupo) => {
        const unica = grupo.minEscolhas === 1 && grupo.maxEscolhas === 1
        const marcadas = escolhas[grupo.id] ?? []
        const cheio = !unica && grupo.maxEscolhas > 1 && marcadas.length >= grupo.maxEscolhas
        return (
          <fieldset key={grupo.id} className="grupo">
            <legend>
              {grupo.nome} <span className="grupo-regra">{mensagemGrupo(grupo)}</span>
            </legend>
            {grupo.opcoes.map((opcao) => {
              const marcada = marcadas.includes(opcao.id)
              return (
                <label
                  key={opcao.id}
                  className={`opcao${!opcao.disponivel ? ' indisponivel' : ''}`}
                >
                  <input
                    type={unica ? 'radio' : 'checkbox'}
                    name={grupo.id}
                    checked={marcada}
                    disabled={!opcao.disponivel || (cheio && !marcada)}
                    onChange={() => alternar(grupo, opcao.id)}
                  />
                  <span className="opcao-nome">{opcao.nome}</span>
                  <span className="opcao-preco">
                    {!opcao.disponivel
                      ? 'Esgotado'
                      : opcao.precoAdicionalCentavos > 0
                        ? `+ ${formatarPreco(opcao.precoAdicionalCentavos)}`
                        : ''}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )
      })}

      <label className="campo">
        Alguma observação?
        <textarea
          rows={2}
          maxLength={140}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: sem cebola"
        />
      </label>
    </Modal>
  )
}
