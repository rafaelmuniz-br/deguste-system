// O laço do agente: pega o próximo pedido da fila, imprime, e SÓ ENTÃO confirma.
//
// Princípio: é melhor sair um recibo duplicado do que um pedido pago não sair. Por isso:
//  - falha ao imprimir  -> avisa o banco (que tenta de novo com espera crescente);
//  - imprimiu mas não conseguiu confirmar -> registra em alto e bom som; a reserva expira e o pedido
//    volta para a fila (pode sair duas vias), nunca some.

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mensagemDe = (e) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

export function criarAgente({
  api,
  transporte,
  formatar,
  log = console,
  intervaloMs = 3000,
  esperar = pausa,
  tentativasConfirmacao = 3,
}) {
  let parar = false
  let apiEstavaOk = true

  /** Um ciclo: devolve o que aconteceu, para o laço (e os testes) decidirem o próximo passo. */
  async function ciclo() {
    let job
    try {
      job = await api.proxima()
      if (!apiEstavaOk) log.info('Conexão com o sistema restabelecida.')
      apiEstavaOk = true
    } catch (e) {
      if (apiEstavaOk) log.error(`Sem conexão com o sistema (${mensagemDe(e)}). Vou continuar tentando.`)
      apiEstavaOk = false
      return 'erro_api'
    }
    if (!job) return 'vazio'

    const numero = job.pedido.numero
    try {
      await transporte.enviar(formatar(job))
    } catch (e) {
      const motivo = mensagemDe(e)
      log.error(`Pedido ${numero}: NÃO imprimiu (${motivo}). Tentativa ${job.tentativa}.`)
      try {
        await api.falha(job.impressao_id, motivo)
      } catch (e2) {
        log.error(`Pedido ${numero}: também não consegui avisar o sistema (${mensagemDe(e2)}). A reserva vai expirar e ele volta para a fila.`)
      }
      return 'falha'
    }

    for (let t = 1; t <= tentativasConfirmacao; t++) {
      try {
        await api.confirmar(job.impressao_id)
        log.info(`Pedido ${numero}: impresso${job.reimpressao ? ' (reimpressão)' : ''}.`)
        return 'impresso'
      } catch (e) {
        if (t === tentativasConfirmacao) {
          log.error(`Pedido ${numero}: IMPRESSO, mas NÃO consegui confirmar (${mensagemDe(e)}). Ele voltará para a fila e poderá sair uma segunda via.`)
        } else {
          await esperar(1000 * t)
        }
      }
    }
    return 'impresso_sem_confirmacao'
  }

  async function iniciar() {
    parar = false
    log.info(`Agente de impressão ligado. Impressora: ${transporte.nome}.`)
    let esperaErro = intervaloMs
    while (!parar) {
      const resultado = await ciclo()
      if (resultado === 'erro_api') {
        // sem internet: espera cada vez mais (até 30 s) para não martelar
        await esperar(esperaErro)
        esperaErro = Math.min(30_000, esperaErro * 2)
        continue
      }
      esperaErro = intervaloMs
      if (resultado === 'vazio') await esperar(intervaloMs)
    }
    log.info('Agente de impressão desligado.')
  }

  return { ciclo, iniciar, parar: () => { parar = true } }
}
