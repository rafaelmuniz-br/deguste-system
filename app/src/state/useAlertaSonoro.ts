import { useEffect, useRef } from 'react'

/** Toca três bipes agudos. Recebe o contexto de áudio (injetável para teste). */
export function tocarAlerta(
  ctx: Pick<AudioContext, 'currentTime' | 'destination' | 'createOscillator' | 'createGain'>,
) {
  const inicio = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const ganho = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    ganho.gain.value = 0.2
    osc.connect(ganho)
    ganho.connect(ctx.destination)
    osc.start(inicio + i * 0.3)
    osc.stop(inicio + i * 0.3 + 0.18)
  }
}

const REPETIR_A_CADA_MS = 20_000
// Referência ESTÁVEL: se fosse criada a cada render, o efeito reiniciaria o intervalo toda hora.
const criarContextoPadrao = () => new AudioContext()

/**
 * Alerta sonoro para pedido novo: toca quando chega um pedido novo e continua repetindo a cada
 * 20 s enquanto houver pedido novo sem atendimento (cozinha barulhenta: um bipe só passa batido).
 *
 * O navegador só libera áudio depois de um clique da pessoa, por isso a tela tem o botão "Ativar som".
 * `criarContexto` é injetável para os testes.
 */
export function useAlertaSonoro(
  novos: number,
  ativo: boolean,
  criarContexto: () => AudioContext = criarContextoPadrao,
) {
  const ctxRef = useRef<AudioContext | null>(null)
  const anterior = useRef(0)

  useEffect(() => {
    if (!ativo) {
      anterior.current = novos
      return
    }
    const tocar = () => {
      try {
        ctxRef.current ??= criarContexto()
        void ctxRef.current.resume?.()
        tocarAlerta(ctxRef.current)
      } catch {
        // sem áudio disponível: a tela continua avisando visualmente
      }
    }
    if (novos > anterior.current) tocar()
    anterior.current = novos
    if (novos === 0) return
    const timer = setInterval(tocar, REPETIR_A_CADA_MS)
    return () => clearInterval(timer)
  }, [novos, ativo, criarContexto])
}
