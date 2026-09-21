import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal.tsx'
import PortaoAdmin from '../components/PortaoAdmin.tsx'
import {
  criarCozinhaSupabase,
  type ApiCozinha,
  type ConexaoTempoReal,
  type PagamentoParaRevisar,
  type ProblemaImpressao,
} from '../data/cozinhaApi.ts'
import { formatarPreco } from '../domain/dinheiro.ts'
import {
  acaoPrincipal,
  agrupar,
  COLUNAS,
  linkDaRota,
  linkWaze,
  linkWhatsapp,
  mensagemParaEntregador,
  minutosDesde,
  nivelDeAtraso,
  podeCancelar,
  type PedidoCozinha,
} from '../domain/cozinha.ts'
import { formatarTelefone } from '../domain/telefone.ts'
import { supabase } from '../lib/supabase.ts'
import AuthProvider from '../state/AuthProvider.tsx'
import { tocarAlerta, useAlertaSonoro } from '../state/useAlertaSonoro.ts'
import '../cardapio.css'
import '../admin.css'
import '../cozinha.css'

const ATUALIZAR_A_CADA_MS = 15_000
const CHAVE_SOM = 'deguste:cozinha:som'
const TEMPO_PREPARO_PADRAO_MIN = 30 // usado enquanto a configuração da loja não carrega

const lerSom = () => {
  try {
    return localStorage.getItem(CHAVE_SOM) === '1'
  } catch {
    return false
  }
}

export default function Cozinha({
  cliente,
  api,
}: {
  cliente?: SupabaseClient | null
  /** Injetável para teste; em produção usa o Supabase. */
  api?: ApiCozinha
}) {
  return (
    <AuthProvider cliente={cliente}>
      <PortaoAdmin titulo="Cozinha">{() => <Painel apiInjetada={api} />}</PortaoAdmin>
    </AuthProvider>
  )
}

function Painel({ apiInjetada }: { apiInjetada?: ApiCozinha }) {
  const api = useMemo(
    () => apiInjetada ?? (supabase ? criarCozinhaSupabase(supabase) : null),
    [apiInjetada],
  )
  const [pedidos, setPedidos] = useState<PedidoCozinha[]>([])
  const [problemas, setProblemas] = useState<ProblemaImpressao[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoParaRevisar[]>([])
  const [carregado, setCarregado] = useState(false)
  const [falhaDeCarga, setFalhaDeCarga] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [conexao, setConexao] = useState<ConexaoTempoReal>('conectando')
  const [agora, setAgora] = useState(() => new Date())
  const [somAtivo, setSomAtivo] = useState(lerSom)
  const [tempoPreparo, setTempoPreparo] = useState(TEMPO_PREPARO_PADRAO_MIN)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [cancelando, setCancelando] = useState<PedidoCozinha | null>(null)

  const carregar = useCallback(async () => {
    if (!api) return
    try {
      const [lista, probs, pags, tempo] = await Promise.all([
        api.listar(),
        api.problemasImpressao().catch(() => []),
        // Sem conseguir consultar, não apaga o aviso que já estava na tela.
        api.pagamentosParaRevisar().catch(() => null),
        api.tempoPreparoMin().catch(() => null), // sem a configuração, mantém o último valor conhecido
      ])
      setPedidos(lista)
      setProblemas(probs)
      if (pags) setPagamentos(pags)
      if (tempo && tempo > 0) setTempoPreparo(tempo)
      setFalhaDeCarga(false)
      setAtualizadoEm(new Date())
    } catch {
      // Mantém o que já estava na tela e avisa que está desatualizado (a cozinha não pode ficar cega).
      setFalhaDeCarga(true)
    } finally {
      setCarregado(true)
    }
  }, [api])

  // Carga inicial + rede de segurança (consulta a cada 15 s, ao voltar para a aba) + tempo real.
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!api) return
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos (rede); o setState só ocorre após o await
    void carregar()
    const timer = setInterval(() => void carregar(), ATUALIZAR_A_CADA_MS)
    const aoVoltar = () => {
      if (!document.hidden) void carregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    const desligar = api.assinar(() => {
      clearTimeout(debounce.current)
      debounce.current = setTimeout(() => void carregar(), 300) // vários eventos seguidos = uma consulta
    }, setConexao)
    return () => {
      clearInterval(timer)
      clearTimeout(debounce.current)
      document.removeEventListener('visibilitychange', aoVoltar)
      desligar()
    }
  }, [api, carregar])

  // Relógio da tela (tempo de espera dos cartões).
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const colunas = useMemo(() => agrupar(pedidos), [pedidos])
  useAlertaSonoro(colunas.novos.length, somAtivo)

  function alternarSom() {
    const novo = !somAtivo
    setSomAtivo(novo)
    try {
      localStorage.setItem(CHAVE_SOM, novo ? '1' : '0')
    } catch {
      // sem armazenamento: só não lembra da escolha
    }
    if (novo) {
      try {
        tocarAlerta(new AudioContext()) // um bipe de teste (e libera o áudio do navegador)
      } catch {
        setAviso('Este aparelho não conseguiu tocar som. O aviso visual continua funcionando.')
      }
    }
  }

  async function executar(p: PedidoCozinha, para: PedidoCozinha['status'], motivo?: string) {
    if (!api || ocupado) return
    setOcupado(p.id)
    setAviso('')
    const r = await api.mudarStatus(p.id, p.status, para, motivo)
    if (!r.ok) {
      setAviso(
        r.motivo === 'conflito'
          ? `O pedido ${p.numero} já foi alterado por outra pessoa. Atualizei a tela.`
          : `Não consegui atualizar o pedido ${p.numero}. Tente de novo.`,
      )
    }
    await carregar()
    setOcupado(null)
  }

  async function resolverPagamento(id: string) {
    if (!api) return
    setAviso(
      (await api.resolverPagamento(id))
        ? 'Pagamento marcado como resolvido.'
        : 'Não consegui marcar como resolvido. Tente de novo.',
    )
    await carregar()
  }

  async function reimprimir(numero: number, id: string) {
    if (!api) return
    setAviso(
      (await api.reimprimir(id))
        ? `Pedido ${numero} enviado para reimpressão.`
        : `Não consegui reimprimir o pedido ${numero}.`,
    )
    await carregar()
  }

  const semTempoReal = conexao === 'desconectado'

  return (
    <main className="cozinha">
      <header className="cozinha-topo">
        <h1>Cozinha</h1>
        <div className="cozinha-controles">
          <p
            role="status"
            className={`conexao ${semTempoReal ? 'ruim' : conexao === 'conectado' ? 'boa' : ''}`}
          >
            {semTempoReal
              ? '● Sem tempo real: atualizando a cada 15 s. Confira a internet.'
              : conexao === 'conectado'
                ? '● Tempo real conectado'
                : 'Conectando…'}
          </p>
          <button
            type="button"
            className="btn-secundario"
            aria-pressed={somAtivo}
            onClick={alternarSom}
          >
            {somAtivo ? '🔔 Som ligado' : '🔕 Ativar som'}
          </button>
          <Link to="/admin/produtos">Marcar esgotado</Link>
          <Link to="/admin">Painel admin</Link>
        </div>
      </header>

      {falhaDeCarga && (
        <p role="alert" className="erros">
          Não conseguimos atualizar os pedidos
          {atualizadoEm
            ? ` (última atualização às ${atualizadoEm.toLocaleTimeString('pt-BR')})`
            : ''}
          . O que aparece pode estar desatualizado. Tentando de novo…
        </p>
      )}

      {problemas.length > 0 && (
        <section className="erros" role="alert" aria-label="Problemas de impressão">
          <strong>
            {problemas.length === 1
              ? '1 pedido não saiu impresso'
              : `${problemas.length} pedidos não saíram impressos`}
            :
          </strong>
          <ul>
            {problemas.map((p) => (
              <li key={p.numero}>
                Pedido {p.numero}
                {p.erro ? ` (${p.erro})` : ''}{' '}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    const alvo = pedidos.find((x) => x.numero === p.numero)
                    if (alvo) void reimprimir(alvo.numero, alvo.id)
                  }}
                >
                  Reimprimir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pagamentos.length > 0 && (
        <section className="erros" role="alert" aria-label="Pagamentos para conferir">
          <strong>
            {pagamentos.length === 1
              ? '1 pagamento precisa de conferência'
              : `${pagamentos.length} pagamentos precisam de conferência`}
            :
          </strong>
          <ul>
            {pagamentos.map((p) => (
              <li key={p.id}>
                Pedido {p.numero}:{' '}
                {p.motivo === 'pago_apos_cancelamento'
                  ? `o Pix de ${formatarPreco(p.valorCentavos)} chegou depois do pedido ser cancelado ou expirar. Devolva o valor no painel do gateway (estorno).`
                  : `chegou ${formatarPreco(p.valorCentavos)}, valor diferente do total do pedido. Confira no painel do gateway.`}{' '}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => void resolverPagamento(p.id)}
                >
                  Já resolvi (pedido {p.numero})
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aviso && (
        <p role="status" className="cozinha-aviso">
          {aviso}
        </p>
      )}

      {!carregado ? (
        <p role="status">Carregando pedidos…</p>
      ) : (
        <div className="quadro">
          {COLUNAS.map((coluna) => (
            <section key={coluna.id} className="coluna" aria-label={coluna.titulo}>
              <h2>
                {coluna.titulo} <span className="contagem">{colunas[coluna.id].length}</span>
              </h2>
              {colunas[coluna.id].length === 0 && <p className="dica">Nenhum pedido.</p>}
              <ul>
                {colunas[coluna.id].map((p) => (
                  <Cartao
                    key={p.id}
                    pedido={p}
                    agora={agora}
                    tempoPreparo={tempoPreparo}
                    ocupado={ocupado === p.id}
                    onAcao={(para) => void executar(p, para)}
                    onCancelar={() => setCancelando(p)}
                    onReimprimir={() => void reimprimir(p.numero, p.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {cancelando && (
        <CancelarModal
          pedido={cancelando}
          onFechar={() => setCancelando(null)}
          onConfirmar={async (motivo) => {
            const alvo = cancelando
            setCancelando(null)
            await executar(alvo, 'cancelado', motivo)
          }}
        />
      )}
    </main>
  )
}

function Cartao({
  pedido: p,
  agora,
  tempoPreparo,
  ocupado,
  onAcao,
  onCancelar,
  onReimprimir,
}: {
  pedido: PedidoCozinha
  agora: Date
  tempoPreparo: number
  ocupado: boolean
  onAcao: (para: PedidoCozinha['status']) => void
  onCancelar: () => void
  onReimprimir: () => void
}) {
  const acao = acaoPrincipal(p)
  const minutos = minutosDesde(p.criadoEm, agora)
  const nivel = nivelDeAtraso(p.status, minutos, tempoPreparo)
  const rota = p.tipo === 'entrega' ? linkDaRota(p.endereco) : null
  const waze = p.tipo === 'entrega' ? linkWaze(p.endereco) : null
  const mensagem = p.tipo === 'entrega' ? mensagemParaEntregador(p) : null

  return (
    <li className={`cartao-pedido ${nivel}`}>
      <div className="cartao-topo">
        <strong className="numero">Pedido {p.numero}</strong>
        <span className="tag">{p.tipo === 'entrega' ? 'Entrega' : 'Retirada'}</span>
        {p.canal !== 'proprio' && (
          <span className="tag">{p.canal === 'ifood' ? 'iFood' : '99Food'}</span>
        )}
        <span className={`espera ${nivel}`}>
          {minutos} min{nivel === 'atrasado' ? ' · ATRASADO' : ''}
        </span>
      </div>

      <ul className="cartao-itens">
        {p.itens.map((i, k) => (
          <li key={k}>
            <strong>
              {i.quantidade}× {i.nome}
            </strong>
            {i.componentes.map((c, j) => (
              <span key={j} className="escolha">
                {c.grupo}: {c.quantidade > 1 ? `${c.quantidade}× ` : ''}
                {c.opcao}
              </span>
            ))}
            {i.observacoes && <span className="obs-destaque">⚠ {i.observacoes}</span>}
          </li>
        ))}
      </ul>

      {p.observacoes && <p className="obs-destaque">⚠ Pedido: {p.observacoes}</p>}

      <p className="cartao-cliente">
        {p.clienteNome} ·{' '}
        <a href={`tel:+55${p.clienteTelefone}`}>{formatarTelefone(p.clienteTelefone)}</a>
        {p.endereco?.rua && (
          <>
            <br />
            {p.endereco.rua}
            {p.endereco.numero ? `, ${p.endereco.numero}` : ''} — {p.endereco.bairro}
            {p.endereco.complemento ? ` (${p.endereco.complemento})` : ''}
            {p.endereco.referencia ? ` · ref.: ${p.endereco.referencia}` : ''}
          </>
        )}
      </p>
      <p className="dica">Total {formatarPreco(p.totalCentavos)}</p>

      <div className="cartao-acoes">
        {acao && (
          <button
            type="button"
            className="btn-primario"
            disabled={ocupado}
            onClick={() => onAcao(acao.para)}
          >
            {acao.rotulo}
          </button>
        )}
        {rota && (
          <a className="btn-secundario" href={rota} target="_blank" rel="noreferrer">
            Rota no mapa
          </a>
        )}
        {waze && (
          <a className="btn-secundario" href={waze} target="_blank" rel="noreferrer">
            Waze
          </a>
        )}
        {mensagem && (
          <a
            className="btn-secundario"
            href={linkWhatsapp(mensagem)}
            target="_blank"
            rel="noreferrer"
          >
            Enviar ao entregador (WhatsApp)
          </a>
        )}
        <button type="button" className="btn-secundario" onClick={onReimprimir}>
          Reimprimir
        </button>
        {podeCancelar(p.status) && (
          <button type="button" className="btn-link" onClick={onCancelar}>
            {p.status === 'novo' ? 'Recusar' : 'Cancelar'}
          </button>
        )}
      </div>
    </li>
  )
}

function CancelarModal({
  pedido,
  onFechar,
  onConfirmar,
}: {
  pedido: PedidoCozinha
  onFechar: () => void
  onConfirmar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const valido = motivo.trim().length >= 3
  return (
    <Modal
      titulo={`${pedido.status === 'novo' ? 'Recusar' : 'Cancelar'} o pedido ${pedido.numero}`}
      onFechar={onFechar}
      rodape={
        <div className="rodape-acoes">
          <button type="button" className="btn-secundario" onClick={onFechar}>
            Voltar
          </button>
          <button
            type="button"
            className="btn-primario"
            disabled={!valido}
            onClick={() => onConfirmar(motivo.trim())}
          >
            Confirmar
          </button>
        </div>
      }
    >
      <p>
        Se o cliente já pagou, será preciso devolver o valor. Escreva o motivo (ele fica registrado
        no pedido):
      </p>
      <label className="campo">
        Motivo
        <textarea
          rows={3}
          maxLength={200}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
    </Modal>
  )
}
