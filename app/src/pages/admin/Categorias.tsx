import { useCallback, useEffect, useState } from 'react'
import Modal from '../../components/Modal.tsx'
import type { ApiCatalogoAdmin } from '../../data/catalogoAdminApi.ts'
import { moverNaLista, validarCategoria, type CategoriaAdmin } from '../../domain/adminCatalogo.ts'

type Edicao = { id?: string; nome: string; descricao: string; ativo: boolean }

const NOVA: Edicao = { nome: '', descricao: '', ativo: true }

export default function Categorias({ api }: { api: ApiCatalogoAdmin }) {
  const [lista, setLista] = useState<CategoriaAdmin[] | null>(null)
  const [falha, setFalha] = useState(false)
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState<Edicao | null>(null)
  const [excluindo, setExcluindo] = useState<CategoriaAdmin | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLista(await api.listarCategorias())
      setFalha(false)
    } catch {
      setFalha(true)
    }
  }, [api])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos; o setState só ocorre após o await
    void carregar()
  }, [carregar])

  async function mover(id: string, direcao: -1 | 1) {
    if (!lista) return
    const novaOrdem = moverNaLista(
      lista.map((c) => c.id),
      id,
      direcao,
    )
    if (!novaOrdem) return
    const r = await api.reordenarCategorias(novaOrdem)
    setAviso(r.ok ? '' : r.mensagem)
    await carregar()
  }

  async function confirmarExclusao(c: CategoriaAdmin) {
    setExcluindo(null)
    const r = await api.excluirCategoria(c.id)
    setAviso(r.ok ? `Categoria "${c.nome}" excluída.` : r.mensagem)
    await carregar()
  }

  return (
    <section aria-labelledby="titulo-categorias">
      <div className="admin-secao-topo">
        <h2 id="titulo-categorias">Categorias</h2>
        <button type="button" className="btn-primario" onClick={() => setEditando(NOVA)}>
          Nova categoria
        </button>
      </div>
      <p className="dica">
        A ordem daqui é a ordem em que as categorias aparecem no cardápio. Categoria inativa some do
        cardápio, mas os produtos dela são mantidos.
      </p>

      {aviso && (
        <p role="status" className="admin-aviso">
          {aviso}
        </p>
      )}
      {falha && (
        <p role="alert" className="erros">
          Não foi possível carregar as categorias.{' '}
          <button type="button" className="btn-link" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </p>
      )}
      {!lista && !falha && <p role="status">Carregando…</p>}
      {lista?.length === 0 && <p>Nenhuma categoria ainda. Crie a primeira.</p>}

      <ul className="admin-lista">
        {lista?.map((c, i) => (
          <li key={c.id} className={c.ativo ? '' : 'inativo'}>
            <div className="admin-item-info">
              <strong>{c.nome}</strong>
              {!c.ativo && <span className="tag">Inativa</span>}
              {c.descricao && <span className="dica">{c.descricao}</span>}
            </div>
            <div className="admin-item-acoes">
              <button
                type="button"
                className="btn-secundario"
                aria-label={`Subir ${c.nome}`}
                disabled={i === 0}
                onClick={() => void mover(c.id, -1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="btn-secundario"
                aria-label={`Descer ${c.nome}`}
                disabled={i === lista.length - 1}
                onClick={() => void mover(c.id, 1)}
              >
                ▼
              </button>
              <button
                type="button"
                className="btn-secundario"
                aria-label={`Editar ${c.nome}`}
                onClick={() =>
                  setEditando({ id: c.id, nome: c.nome, descricao: c.descricao, ativo: c.ativo })
                }
              >
                Editar
              </button>
              <button
                type="button"
                className="btn-link"
                aria-label={`Excluir ${c.nome}`}
                onClick={() => setExcluindo(c)}
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editando && (
        <FormCategoria
          inicial={editando}
          api={api}
          onFechar={() => setEditando(null)}
          onSalvo={async () => {
            setEditando(null)
            setAviso('Categoria salva.')
            await carregar()
          }}
        />
      )}

      {excluindo && (
        <Modal
          titulo={`Excluir "${excluindo.nome}"?`}
          onFechar={() => setExcluindo(null)}
          rodape={
            <div className="rodape-acoes">
              <button type="button" className="btn-secundario" onClick={() => setExcluindo(null)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn-primario"
                onClick={() => void confirmarExclusao(excluindo)}
              >
                Excluir de vez
              </button>
            </div>
          }
        >
          <p>
            Só é possível excluir categoria sem produtos. Se a intenção é apenas tirar do cardápio,
            use <strong>Editar</strong> e desmarque “Aparece no cardápio”.
          </p>
        </Modal>
      )}
    </section>
  )
}

function FormCategoria({
  inicial,
  api,
  onFechar,
  onSalvo,
}: {
  inicial: Edicao
  api: ApiCatalogoAdmin
  onFechar: () => void
  onSalvo: () => Promise<void>
}) {
  const [f, setF] = useState(inicial)
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = validarCategoria(f)
    if (!v.ok) return setErros(v.erros)
    setErros([])
    setSalvando(true)
    const r = await api.salvarCategoria(v.valor, f.id)
    setSalvando(false)
    if (r.ok) await onSalvo()
    else setErros([r.mensagem])
  }

  return (
    <Modal
      titulo={f.id ? 'Editar categoria' : 'Nova categoria'}
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
        Nome
        <input
          value={f.nome}
          maxLength={60}
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
      </label>
      <label className="campo">
        Descrição (opcional)
        <input
          value={f.descricao}
          maxLength={200}
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
        />
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
