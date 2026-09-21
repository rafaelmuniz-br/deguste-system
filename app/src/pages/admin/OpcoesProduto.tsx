import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Modal from '../../components/Modal.tsx'
import type { ApiOpcoesAdmin, OpcoesDoProduto } from '../../data/opcoesAdminApi.ts'
import { centavosParaReais, moverNaLista } from '../../domain/adminCatalogo.ts'
import {
  descreverRegra,
  validarGrupo,
  validarOpcao,
  type FormGrupo,
  type FormOpcao,
  type GrupoAdmin,
  type OpcaoAdmin,
} from '../../domain/adminOpcoes.ts'
import { formatarPreco } from '../../domain/dinheiro.ts'

type EditandoGrupo = FormGrupo & { id?: string }
type EditandoOpcao = FormOpcao & { id?: string; grupoId: string }
type Exclusao = { tipo: 'grupo'; grupo: GrupoAdmin } | { tipo: 'opcao'; opcao: OpcaoAdmin }

export default function OpcoesProduto({ api }: { api: ApiOpcoesAdmin }) {
  const { id: produtoId = '' } = useParams()
  const [dados, setDados] = useState<OpcoesDoProduto | null>(null)
  const [falha, setFalha] = useState(false)
  const [aviso, setAviso] = useState('')
  const [grupoEm, setGrupoEm] = useState<EditandoGrupo | null>(null)
  const [opcaoEm, setOpcaoEm] = useState<EditandoOpcao | null>(null)
  const [excluindo, setExcluindo] = useState<Exclusao | null>(null)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.carregar(produtoId))
      setFalha(false)
    } catch {
      setFalha(true)
    }
  }, [api, produtoId])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos; o setState só ocorre após o await
    void carregar()
  }, [carregar])

  const terminar = async (r: { ok: true } | { ok: false; mensagem: string }, ok = '') => {
    setAviso(r.ok ? ok : r.mensagem)
    await carregar()
  }

  async function moverGrupo(id: string, direcao: -1 | 1) {
    const nova = moverNaLista(dados?.grupos.map((g) => g.id) ?? [], id, direcao)
    if (nova) await terminar(await api.reordenarGrupos(nova))
  }

  async function moverOpcao(grupo: GrupoAdmin, id: string, direcao: -1 | 1) {
    const nova = moverNaLista(
      grupo.opcoes.map((o) => o.id),
      id,
      direcao,
    )
    if (nova) await terminar(await api.reordenarOpcoes(nova))
  }

  async function alternarEsgotada(o: OpcaoAdmin) {
    await terminar(
      await api.alterarDisponibilidade(o.id, !o.disponivel),
      o.disponivel ? `"${o.nome}" marcada como esgotada.` : `"${o.nome}" voltou ao estoque.`,
    )
  }

  async function confirmarExclusao(e: Exclusao) {
    setExcluindo(null)
    if (e.tipo === 'grupo') {
      await terminar(await api.excluirGrupo(e.grupo.id), `Grupo "${e.grupo.nome}" excluído.`)
    } else {
      await terminar(await api.excluirOpcao(e.opcao.id), `Opção "${e.opcao.nome}" excluída.`)
    }
  }

  const nomeDoProduto = (id: string | null) => dados?.produtos.find((p) => p.id === id)?.nome

  return (
    <section aria-labelledby="titulo-opcoes">
      <p>
        <Link to="/admin/produtos">← Voltar aos produtos</Link>
      </p>
      {falha && (
        <p role="alert" className="erros">
          Não foi possível carregar as opções deste produto.{' '}
          <button type="button" className="btn-link" onClick={() => void carregar()}>
            Tentar de novo
          </button>
        </p>
      )}
      {!dados && !falha && <p role="status">Carregando…</p>}
      {dados && (
        <>
          <div className="admin-secao-topo">
            <h2 id="titulo-opcoes">Opções de {dados.produto.nome}</h2>
            <button
              type="button"
              className="btn-primario"
              onClick={() => setGrupoEm({ nome: '', minEscolhas: '1', maxEscolhas: '1' })}
            >
              Novo grupo
            </button>
          </div>
          <p className="dica">
            Um <strong>grupo</strong> é uma pergunta ao cliente (“Ponto da carne”, “Adicionais”,
            “Escolha seu hambúrguer”). Dentro dele ficam as <strong>opções</strong> para escolher.
            {dados.produto.ehCombo &&
              ' Como este produto é um combo, ligue cada opção a um produto real: assim os relatórios contam o hambúrguer certo.'}
          </p>

          {aviso && (
            <p role="status" className="admin-aviso">
              {aviso}
            </p>
          )}
          {dados.grupos.length === 0 && (
            <p>Este produto não tem grupos de opção. Ele é vendido do jeito que está.</p>
          )}

          {dados.grupos.map((g, gi) => (
            <section key={g.id} aria-label={g.nome} className="admin-grupo-opcao">
              <div className="admin-secao-topo">
                <h3>
                  {g.nome}{' '}
                  <span className="tag">{descreverRegra(g.minEscolhas, g.maxEscolhas)}</span>
                </h3>
                <div className="admin-item-acoes">
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Subir grupo ${g.nome}`}
                    disabled={gi === 0}
                    onClick={() => void moverGrupo(g.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Descer grupo ${g.nome}`}
                    disabled={gi === dados.grupos.length - 1}
                    onClick={() => void moverGrupo(g.id, 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="btn-secundario"
                    aria-label={`Editar grupo ${g.nome}`}
                    onClick={() =>
                      setGrupoEm({
                        id: g.id,
                        nome: g.nome,
                        minEscolhas: String(g.minEscolhas),
                        maxEscolhas: String(g.maxEscolhas),
                      })
                    }
                  >
                    Editar grupo
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    aria-label={`Excluir grupo ${g.nome}`}
                    onClick={() => setExcluindo({ tipo: 'grupo', grupo: g })}
                  >
                    Excluir grupo
                  </button>
                </div>
              </div>

              {g.opcoes.length === 0 && <p className="dica">Nenhuma opção neste grupo ainda.</p>}
              <ul className="admin-lista">
                {g.opcoes.map((o, oi) => (
                  <li key={o.id} className={o.ativo ? '' : 'inativo'}>
                    <div className="admin-item-info">
                      <strong>{o.nome}</strong>
                      {o.precoAdicionalCentavos > 0 && (
                        <span>+ {formatarPreco(o.precoAdicionalCentavos)}</span>
                      )}
                      {o.produtoId && (
                        <span className="tag">
                          Produto: {nomeDoProduto(o.produtoId) ?? 'não encontrado'}
                        </span>
                      )}
                      {!o.disponivel && <span className="tag tag-esgotado">Esgotada</span>}
                      {!o.ativo && <span className="tag">Escondida do cardápio</span>}
                    </div>
                    <div className="admin-item-acoes">
                      <button
                        type="button"
                        className="btn-secundario"
                        aria-label={`${o.disponivel ? 'Marcar esgotada' : 'Voltou ao estoque'}: ${o.nome}`}
                        aria-pressed={!o.disponivel}
                        onClick={() => void alternarEsgotada(o)}
                      >
                        {o.disponivel ? 'Marcar esgotada' : 'Voltou ao estoque'}
                      </button>
                      <button
                        type="button"
                        className="btn-secundario"
                        aria-label={`Subir opção ${o.nome}`}
                        disabled={oi === 0}
                        onClick={() => void moverOpcao(g, o.id, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn-secundario"
                        aria-label={`Descer opção ${o.nome}`}
                        disabled={oi === g.opcoes.length - 1}
                        onClick={() => void moverOpcao(g, o.id, 1)}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="btn-secundario"
                        aria-label={`Editar opção ${o.nome}`}
                        onClick={() =>
                          setOpcaoEm({
                            id: o.id,
                            grupoId: g.id,
                            nome: o.nome,
                            precoAdicional:
                              o.precoAdicionalCentavos > 0
                                ? centavosParaReais(o.precoAdicionalCentavos)
                                : '',
                            produtoId: o.produtoId ?? '',
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-link"
                        aria-label={`Excluir opção ${o.nome}`}
                        onClick={() => setExcluindo({ tipo: 'opcao', opcao: o })}
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-secundario"
                aria-label={`Adicionar opção em ${g.nome}`}
                onClick={() =>
                  setOpcaoEm({ grupoId: g.id, nome: '', precoAdicional: '', produtoId: '' })
                }
              >
                + Adicionar opção
              </button>
            </section>
          ))}

          {grupoEm && (
            <FormGrupoModal
              inicial={grupoEm}
              onFechar={() => setGrupoEm(null)}
              onSalvar={async (g) => {
                const r = await api.salvarGrupo(produtoId, g, grupoEm.id)
                if (r.ok) {
                  setGrupoEm(null)
                  await terminar(r, 'Grupo salvo.')
                }
                return r
              }}
            />
          )}

          {opcaoEm && (
            <FormOpcaoModal
              inicial={opcaoEm}
              produtos={dados.produtos}
              onFechar={() => setOpcaoEm(null)}
              onSalvar={async (o) => {
                const r = await api.salvarOpcao(opcaoEm.grupoId, o, opcaoEm.id)
                if (r.ok) {
                  setOpcaoEm(null)
                  await terminar(r, 'Opção salva.')
                }
                return r
              }}
            />
          )}

          {excluindo && (
            <Modal
              titulo={
                excluindo.tipo === 'grupo'
                  ? `Excluir o grupo "${excluindo.grupo.nome}"?`
                  : `Excluir a opção "${excluindo.opcao.nome}"?`
              }
              onFechar={() => setExcluindo(null)}
              rodape={
                <div className="rodape-acoes">
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => setExcluindo(null)}
                  >
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
                {excluindo.tipo === 'grupo'
                  ? 'O grupo e todas as opções dele saem do cardápio. '
                  : 'A opção sai do cardápio. '}
                Pedidos antigos não mudam (o que o cliente escolheu fica guardado no pedido). Se for
                só um item que acabou, prefira <strong>Marcar esgotada</strong>.
              </p>
            </Modal>
          )}
        </>
      )}
    </section>
  )
}

type Resposta = { ok: true } | { ok: false; mensagem: string }

function BlocoErros({ erros }: { erros: string[] }) {
  if (erros.length === 0) return null
  return (
    <div role="alert" className="erros">
      <ul>
        {erros.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}

function Rodape({
  onFechar,
  salvando,
  onSalvar,
}: {
  onFechar: () => void
  salvando: boolean
  onSalvar: () => void
}) {
  return (
    <div className="rodape-acoes">
      <button type="button" className="btn-secundario" onClick={onFechar}>
        Cancelar
      </button>
      <button type="button" className="btn-primario" disabled={salvando} onClick={onSalvar}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}

function FormGrupoModal({
  inicial,
  onFechar,
  onSalvar,
}: {
  inicial: EditandoGrupo
  onFechar: () => void
  onSalvar: (g: { nome: string; minEscolhas: number; maxEscolhas: number }) => Promise<Resposta>
}) {
  const [f, setF] = useState(inicial)
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = validarGrupo(f)
    if (!v.ok) return setErros(v.erros)
    setErros([])
    setSalvando(true)
    const r = await onSalvar(v.valor)
    setSalvando(false)
    if (!r.ok) setErros([r.mensagem])
  }

  return (
    <Modal
      titulo={f.id ? 'Editar grupo' : 'Novo grupo'}
      onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} salvando={salvando} onSalvar={() => void salvar()} />}
    >
      <BlocoErros erros={erros} />
      <label className="campo">
        Nome do grupo
        <input
          value={f.nome}
          maxLength={60}
          placeholder="Ponto da carne"
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
      </label>
      <label className="campo">
        Mínimo de escolhas
        <input
          inputMode="numeric"
          value={f.minEscolhas}
          onChange={(e) => setF({ ...f, minEscolhas: e.target.value })}
        />
      </label>
      <label className="campo">
        Máximo de escolhas
        <input
          inputMode="numeric"
          value={f.maxEscolhas}
          onChange={(e) => setF({ ...f, maxEscolhas: e.target.value })}
        />
      </label>
      <p className="dica">
        Mínimo 1 = o cliente é obrigado a escolher. Mínimo 0 = é opcional (adicionais, por exemplo).
        Máximo = quantas ele pode levar.
      </p>
    </Modal>
  )
}

function FormOpcaoModal({
  inicial,
  produtos,
  onFechar,
  onSalvar,
}: {
  inicial: EditandoOpcao
  produtos: { id: string; nome: string }[]
  onFechar: () => void
  onSalvar: (o: {
    nome: string
    precoAdicionalCentavos: number
    produtoId: string | null
  }) => Promise<Resposta>
}) {
  const [f, setF] = useState(inicial)
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = validarOpcao(f)
    if (!v.ok) return setErros(v.erros)
    setErros([])
    setSalvando(true)
    const r = await onSalvar(v.valor)
    setSalvando(false)
    if (!r.ok) setErros([r.mensagem])
  }

  return (
    <Modal
      titulo={f.id ? 'Editar opção' : 'Nova opção'}
      onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} salvando={salvando} onSalvar={() => void salvar()} />}
    >
      <BlocoErros erros={erros} />
      <label className="campo">
        Nome da opção
        <input
          value={f.nome}
          maxLength={80}
          placeholder="Ao ponto"
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
      </label>
      <label className="campo">
        Valor adicional (R$, opcional)
        <input
          inputMode="decimal"
          placeholder="3,50"
          value={f.precoAdicional}
          onChange={(e) => setF({ ...f, precoAdicional: e.target.value })}
        />
      </label>
      <label className="campo">
        Vende qual produto? (combos)
        <select value={f.produtoId} onChange={(e) => setF({ ...f, produtoId: e.target.value })}>
          <option value="">Nenhum (é só uma escolha)</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>
      <p className="dica">
        Use “Vende qual produto?” nas opções de combo (ex.: “Smash” aponta para o produto Smash),
        para os relatórios contarem o hambúrguer certo.
      </p>
    </Modal>
  )
}
