import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PedidoAcompanhado } from '../data/acompanhamentoApi.ts'
import type { ApiPix } from '../data/pixApi.ts'
import { descreverAndamento, ehTerminal, passoAtual, PASSOS } from '../domain/andamento.ts'
import { formatarPreco } from '../domain/dinheiro.ts'
import PagamentoPix from '../components/PagamentoPix.tsx'
import { useLoja } from '../state/useLoja.ts'

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'ok'; pedido: PedidoAcompanhado }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'indisponivel' }

const INTERVALO_MS = 10_000

/** Acompanhamento do pedido pelo token (sem login). Consulta de tempos em tempos enquanto a aba está visível. */
export default function Acompanhar() {
  const { token = '' } = useParams()
  const { acompanhamento, apiSimulada, pix } = useLoja()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  // "Já paguei" pede uma consulta imediata em vez de esperar os 10 s.
  const consultarAgora = useRef<() => Promise<void>>(async () => {})
  const conferir = useCallback(() => consultarAgora.current(), [])

  useEffect(() => {
    let ativo = true
    let timer: ReturnType<typeof setInterval> | undefined

    async function consultar() {
      const r = await acompanhamento.buscar(token)
      if (!ativo) return
      if (r.ok) {
        setEstado({ tipo: 'ok', pedido: r.pedido })
        if (ehTerminal(r.pedido.status) && timer) clearInterval(timer) // não muda mais
      } else {
        // Falha passageira não apaga o último status bom que a pessoa já está vendo.
        setEstado((atual) =>
          atual.tipo === 'ok' && r.motivo === 'indisponivel' ? atual : { tipo: r.motivo },
        )
        if (r.motivo === 'nao_encontrado' && timer) clearInterval(timer)
      }
    }

    // A 1ª consulta sempre acontece (a pessoa precisa ver o status ao abrir). As seguintes pausam
    // com a aba em segundo plano, para não gastar requisição à toa, e voltam ao reabrir a aba.
    const naoEstaOculta = () => typeof document === 'undefined' || !document.hidden
    const aoVoltarParaAba = () => {
      if (naoEstaOculta()) void consultar()
    }
    consultarAgora.current = consultar
    void consultar()
    timer = setInterval(() => {
      if (naoEstaOculta()) void consultar()
    }, INTERVALO_MS)
    document.addEventListener('visibilitychange', aoVoltarParaAba)
    return () => {
      ativo = false
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltarParaAba)
    }
  }, [acompanhamento, token])

  useEffect(() => {
    const anterior = document.title
    document.title = 'Acompanhar pedido · Deguste Burguer'
    return () => {
      document.title = anterior
    }
  }, [])

  return (
    <main className="pagina checkout">
      <p>
        <Link to="/">← Voltar ao cardápio</Link>
      </p>

      {apiSimulada && (
        <p className="aviso-exemplo">
          Pedido de TESTE: o andamento é simulado e avança sozinho a cada 15 segundos.
        </p>
      )}

      {estado.tipo === 'carregando' && <p role="status">Buscando seu pedido…</p>}

      {estado.tipo === 'nao_encontrado' && (
        <>
          <h1>Pedido não encontrado</h1>
          <p>
            Não achamos um pedido para este endereço. Confira se o link está completo. Se precisar,
            chame a gente pelo WhatsApp que ajudamos.
          </p>
        </>
      )}

      {estado.tipo === 'indisponivel' && (
        <>
          <h1>Não conseguimos consultar agora</h1>
          <p role="alert">Tente de novo em instantes. Seu pedido não foi afetado.</p>
        </>
      )}

      {estado.tipo === 'ok' && (
        <Andamento pedido={estado.pedido} token={token} pix={pix} aoConferir={conferir} />
      )}
    </main>
  )
}

function Andamento({
  pedido,
  token,
  pix,
  aoConferir,
}: {
  pedido: PedidoAcompanhado
  token: string
  pix: ApiPix
  aoConferir: () => Promise<void>
}) {
  const passos = PASSOS[pedido.tipo]
  const atual = passoAtual(pedido.tipo, pedido.status)
  const mensagem = descreverAndamento(pedido.tipo, pedido.status, pedido.pagamentoStatus)

  return (
    <>
      <h1>Pedido nº {pedido.numero}</h1>
      {/* Região "ao vivo": leitores de tela anunciam quando o status muda. */}
      <p role="status" className={mensagem.alerta ? 'andamento-alerta' : undefined}>
        {mensagem.texto}
      </p>

      {atual !== null && (
        <ol className="linha-tempo" aria-label="Andamento do pedido">
          {passos.map((nome, i) => (
            <li
              key={nome}
              aria-current={i === atual ? 'step' : undefined}
              className={i === atual ? 'atual' : i < atual ? 'feito' : ''}
            >
              {i < atual && <span className="so-leitor">Concluído: </span>}
              {nome}
            </li>
          ))}
        </ol>
      )}

      {pedido.status === 'aguardando_pagamento' && pedido.pagamentoStatus === 'pendente' && (
        <PagamentoPix
          token={token}
          copiaColaInicial={pedido.pixCopiaCola}
          expiraEmInicial={pedido.pagamentoExpiraEm}
          api={pix}
          aoConferir={aoConferir}
        />
      )}

      <p className="dica">
        Total do pedido: <strong>{formatarPreco(pedido.totalCentavos)}</strong>
      </p>
    </>
  )
}
