import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ApiPix } from '../data/pixApi.ts'
import { minutosRestantes } from '../domain/pix.ts'
import { caminhoDoQr, gerarMatrizQr, MARGEM_QR } from '../domain/qr.ts'

const ATUALIZAR_RELOGIO_MS = 15_000
// Referência estável: um `() => new Date()` novo a cada render reiniciaria o relógio toda hora.
const agoraPadrao = () => new Date()

function QrCode({ texto }: { texto: string }) {
  const { caminho, lado } = useMemo(() => {
    const matriz = gerarMatrizQr(texto)
    return { caminho: caminhoDoQr(matriz), lado: matriz.length }
  }, [texto])
  const total = lado + MARGEM_QR * 2
  return (
    <svg
      className="pix-qr"
      role="img"
      aria-label="QR Code para pagar o pedido com Pix"
      viewBox={`${-MARGEM_QR} ${-MARGEM_QR} ${total} ${total}`}
      shapeRendering="crispEdges"
    >
      {/* Fundo branco e módulos pretos SEMPRE (mesmo no modo escuro), senão o leitor do banco não lê. */}
      <rect x={-MARGEM_QR} y={-MARGEM_QR} width={total} height={total} fill="#ffffff" />
      <path d={caminho} fill="#000000" />
    </svg>
  )
}

/**
 * Pagamento por Pix na página do pedido: QR Code, "copia e cola", prazo e o botão "Já paguei".
 * O código vem do servidor (que confere o valor no banco); esta tela só mostra. A confirmação do
 * pagamento chega pelo acompanhamento (a página consulta sozinha e este bloco some quando pagar).
 */
export default function PagamentoPix({
  token,
  copiaColaInicial,
  expiraEmInicial,
  api,
  aoConferir,
  agora = agoraPadrao,
}: {
  token: string
  /** Código que o acompanhamento já trouxe (Pix gerado antes). */
  copiaColaInicial?: string
  expiraEmInicial?: string
  api: ApiPix
  /** Pede ao acompanhamento para consultar o pedido agora ("Já paguei"). */
  aoConferir: () => Promise<void>
  agora?: () => Date
}) {
  const [gerado, setGerado] = useState<{ copiaCola: string; expiraEm?: string } | null>(null)
  const [falha, setFalha] = useState<null | 'expirado' | 'indisponivel'>(null)
  const [tentativa, setTentativa] = useState(0)
  const [relogio, setRelogio] = useState(() => agora())
  const [aviso, setAviso] = useState('')
  const [conferindo, setConferindo] = useState(false)
  const campo = useRef<HTMLTextAreaElement>(null)

  const copiaCola = copiaColaInicial ?? gerado?.copiaCola
  const expiraEm = expiraEmInicial ?? gerado?.expiraEm

  // Ainda não há Pix: pede ao servidor (que devolve o mesmo se já existir; nunca cobra em dobro).
  useEffect(() => {
    if (copiaColaInicial) return
    let ativo = true
    void api.gerar(token).then((r) => {
      if (!ativo) return
      if (r.ok) {
        setGerado({ copiaCola: r.copiaCola, expiraEm: r.expiraEm })
        setFalha(null)
      } else {
        setFalha(r.motivo === 'expirado' ? 'expirado' : 'indisponivel')
      }
    })
    return () => {
      ativo = false
    }
  }, [api, token, copiaColaInicial, tentativa])

  // O relógio só existe para o "faltam X min" e para trocar a tela quando o prazo acaba.
  useEffect(() => {
    const t = setInterval(() => setRelogio(agora()), ATUALIZAR_RELOGIO_MS)
    return () => clearInterval(t)
  }, [agora])

  const minutos = minutosRestantes(expiraEm, relogio)
  const venceu = falha === 'expirado' || (copiaCola !== undefined && minutos === 0)

  async function copiar() {
    if (!copiaCola) return
    try {
      await navigator.clipboard.writeText(copiaCola)
      setAviso('Código copiado. Agora é só colar no app do seu banco.')
    } catch {
      campo.current?.select()
      setAviso(
        'Não deu para copiar sozinho. O código está selecionado: copie e cole no app do banco.',
      )
    }
  }

  async function jaPaguei() {
    setConferindo(true)
    setAviso('')
    await aoConferir()
    setConferindo(false)
    // Se o pagamento já tivesse sido confirmado, este bloco nem estaria na tela.
    setAviso(
      'Ainda não recebemos a confirmação. Pode levar alguns segundos depois de pagar; esta página atualiza sozinha.',
    )
  }

  if (venceu) {
    return (
      <section className="pix" aria-labelledby="titulo-pix">
        <h2 id="titulo-pix">O prazo para pagar acabou</h2>
        <p role="alert">
          Este Pix venceu e o pedido será cancelado. <strong>Não pague este código.</strong> Faça um
          novo pedido pelo cardápio.
        </p>
        <Link className="btn-primario" to="/">
          Fazer um novo pedido
        </Link>
      </section>
    )
  }

  return (
    <section className="pix" aria-labelledby="titulo-pix">
      <h2 id="titulo-pix">Pague com Pix</h2>

      {!copiaCola && !falha && <p role="status">Gerando o seu Pix…</p>}

      {!copiaCola && falha === 'indisponivel' && (
        <>
          <p role="alert" className="erros">
            Não conseguimos gerar o Pix agora. Seu pedido está guardado e nada foi cobrado.
          </p>
          <button type="button" className="btn-primario" onClick={() => setTentativa((n) => n + 1)}>
            Tentar de novo
          </button>
        </>
      )}

      {copiaCola && (
        <>
          <ol className="pix-passos">
            <li>
              Abra o app do seu banco e escolha <strong>Pix</strong>.
            </li>
            <li>
              Leia o QR Code abaixo ou use <strong>Pix Copia e Cola</strong>.
            </li>
            <li>Confira o valor e pague. Esta página confirma sozinha.</li>
          </ol>

          <QrCode texto={copiaCola} />

          <label className="campo">
            Pix Copia e Cola
            <textarea
              ref={campo}
              readOnly
              rows={4}
              value={copiaCola}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button type="button" className="btn-primario" onClick={() => void copiar()}>
            Copiar código
          </button>

          {minutos !== null && (
            <p className="dica">
              Você tem cerca de <strong>{minutos} min</strong> para pagar.
            </p>
          )}

          <button
            type="button"
            className="btn-secundario"
            disabled={conferindo}
            onClick={() => void jaPaguei()}
          >
            {conferindo ? 'Conferindo…' : 'Já paguei'}
          </button>
          <p role="status" className="dica">
            {aviso}
          </p>
        </>
      )}
    </section>
  )
}
