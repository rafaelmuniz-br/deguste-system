import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal.tsx'
import type { ApiCatalogoAdmin } from '../../data/catalogoAdminApi.ts'
import {
  centavosParaReais,
  moverNaLista,
  validarProduto,
  type CategoriaAdmin,
  type FormProduto,
  type ProdutoAdmin,
} from '../../domain/adminCatalogo.ts'
import { formatarPreco } from '../../domain/dinheiro.ts'

type Edicao = FormProduto & { id?: string }

const novo = (categoriaId: string): Edicao => ({
  categoriaId,
  nome: '',
  descricao: '',
  preco: '',
  precoOriginal: '',
  ehCombo: false,
  ativo: true,
})

export default function Produtos({ api }: { api: ApiCatalogoAdmin }) {
  const [categorias, setCategorias] = useState<CategoriaAdmin[] | null>(null)
  const [produtos, setProdutos] = useState<ProdutoAdmin[]>([])
  const [falha, setFalha] = useState(false)
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState<Edicao | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([api.listarCategorias(), api.listarProdutos()])
      setCategorias(cats)
      setProdutos(prods)
      setFalha(false)
    } catch {
      setFalha(true)
    }
  }, [api])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos; o setState só ocorre após o await
    void carregar()
  }, [carregar])

  const grupos = useMemo(
    () =>
      (categorias ?? [])
        .filter((c) => !filtro || c.id === filtro)
        .map((c) => ({ categoria: c, itens: produtos.filter((p) => p.categoriaId === c.id) })),
    [categorias, produtos, filtro],
  )

  async function alternarEsgotado(p: ProdutoAdmin) {
    const r = await api.alterarDisponibilidade(p.id, !p.disponivel)
    setAviso(
      r.ok
        ? p.disponivel
          ? `"${p.nome}" marcado como esgotado.`
          : `"${p.nome}" voltou a ficar disponível.`
        : r.mensagem,
    )
    await carregar()
  }

  async function mover(categoriaId: string, id: string, direcao: -1 | 1) {
    const ids = produtos.filter((p) => p.categoriaId === categoriaId).map((p) => p.id)
    const novaOrdem = moverNaLista(ids, id, direcao)
    if (!novaOrdem) return
    const r = await api.reordenarProdutos(novaOrdem)
    setAviso(r.ok ? '' : r.mensagem)
    await carregar()
  }

  return (
    <section aria-labelledby="titulo-produtos">
      <div className="admin-secao-topo">
        <h2 id="titulo-produtos">Produtos</h2>
        <button
          type="button"
          className="btn-primario"
          disabled={!categorias?.length}
          onClick={() => setEditando(novo(filtro || categorias?.[0]?.id || ''))}
        >
          Novo produto
        </button>
      </div>

      {categorias && categorias.length === 0 && (
        <p>Crie uma categoria antes de cadastrar produtos.</p>
      )}
      {categorias && categorias.length > 1 && (
        <label className="campo">
          Mostrar categoria
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {aviso && (
        <p role="status" className="admin-aviso">
          {aviso}
        </p>
      )}
      {falha && (
        <p role="alert" className="erros">
          Não foi possível carregar os produtos.{' '}
          <button type="button" className="btn-link" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </p>
      )}
      {!categorias && !falha && <p role="status">Carregando…</p>}

      {grupos.map(({ categoria, itens }) => (
        <section key={categoria.id} aria-label={categoria.nome} className="admin-grupo">
          <h3>
            {categoria.nome}
            {!categoria.ativo && <span className="tag">Categoria inativa</span>}
          </h3>
          {itens.length === 0 && <p className="dica">Nenhum produto nesta categoria.</p>}
          <ul className="admin-lista">
            {itens.map((p, i) => (
              <li key={p.id} className={p.ativo ? '' : 'inativo'}>
                <div className="admin-item-info">
                  <strong>{p.nome}</strong>
                  <span>{formatarPreco(p.precoCentavos)}</span>
                  {p.ehCombo && <span className="tag">Combo</span>}
                  {!p.disponivel && <span className="tag tag-esgotado">Esgotado</span>}
                  {!p.ativo && <span className="tag">Escondido do cardápio</span>}
                </div>
                <div className="admin-item-acoes">
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`${p.disponivel ? 'Marcar esgotado' : 'Voltou ao estoque'}: ${p.nome}`}
                    aria-pressed={!p.disponivel}
                    onClick={() => void alternarEsgotado(p)}
                  >
                    {p.disponivel ? 'Marcar esgotado' : 'Voltou ao estoque'}
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Subir ${p.nome}`}
                    disabled={i === 0}
                    onClick={() => void mover(categoria.id, p.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Descer ${p.nome}`}
                    disabled={i === itens.length - 1}
                    onClick={() => void mover(categoria.id, p.id, 1)}
                  >
                    ▼
                  </button>
                  <Link
                    className="btn-secundario"
                    to={`/admin/produtos/${p.id}/opcoes`}
                    aria-label={`Opções de ${p.nome}`}
                  >
                    Opções
                  </Link>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Editar ${p.nome}`}
                    onClick={() =>
                      setEditando({
                        id: p.id,
                        categoriaId: p.categoriaId,
                        nome: p.nome,
                        descricao: p.descricao,
                        preco: centavosParaReais(p.precoCentavos),
                        precoOriginal:
                          p.precoOriginalCentavos === null
                            ? ''
                            : centavosParaReais(p.precoOriginalCentavos),
                        ehCombo: p.ehCombo,
                        ativo: p.ativo,
                      })
                    }
                  >
                    Editar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editando && categorias && (
        <FormProdutoModal
          inicial={editando}
          categorias={categorias}
          api={api}
          onFechar={() => setEditando(null)}
          onSalvo={async () => {
            setEditando(null)
            setAviso('Produto salvo.')
            await carregar()
          }}
        />
      )}
    </section>
  )
}

function FormProdutoModal({
  inicial,
  categorias,
  api,
  onFechar,
  onSalvo,
}: {
  inicial: Edicao
  categorias: CategoriaAdmin[]
  api: ApiCatalogoAdmin
  onFechar: () => void
  onSalvo: () => Promise<void>
}) {
  const [f, setF] = useState(inicial)
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = validarProduto(f)
    if (!v.ok) return setErros(v.erros)
    setErros([])
    setSalvando(true)
    const r = await api.salvarProduto(v.valor, f.id)
    setSalvando(false)
    if (r.ok) await onSalvo()
    else setErros([r.mensagem])
  }

  return (
    <Modal
      titulo={f.id ? 'Editar produto' : 'Novo produto'}
      onFechar={onFechar}
      rodape={
        <div className="rodape-acoes">
          <button type="button" className="btn-secundario" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primario"
            disabled={salvando}
            onClick={() => void salvar()}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      }
    >
      {erros.length > 0 && (
        <div role="alert" className="erros">
          <ul>
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <label className="campo">
        Categoria
        <select value={f.categoriaId} onChange={(e) => setF({ ...f, categoriaId: e.target.value })}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Nome
        <input
          value={f.nome}
          maxLength={80}
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
      </label>
      <label className="campo">
        Descrição (opcional)
        <textarea
          rows={3}
          maxLength={300}
          value={f.descricao}
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
        />
      </label>
      <label className="campo">
        Preço (R$)
        <input
          inputMode="decimal"
          placeholder="21,90"
          value={f.preco}
          onChange={(e) => setF({ ...f, preco: e.target.value })}
        />
      </label>
      <label className="campo">
        Preço “de” (opcional, aparece riscado)
        <input
          inputMode="decimal"
          placeholder="25,90"
          value={f.precoOriginal}
          onChange={(e) => setF({ ...f, precoOriginal: e.target.value })}
        />
      </label>
      <label className="campo-check">
        <input
          type="checkbox"
          checked={f.ehCombo}
          onChange={(e) => setF({ ...f, ehCombo: e.target.checked })}
        />
        É um combo
      </label>
      <label className="campo-check">
        <input
          type="checkbox"
          checked={f.ativo}
          onChange={(e) => setF({ ...f, ativo: e.target.checked })}
        />
        Aparece no cardápio
      </label>
    </Modal>
  )
}
