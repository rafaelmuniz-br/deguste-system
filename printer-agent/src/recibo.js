import { criarEscPos } from './escpos.js'

// Layout do recibo da cozinha. Pensado para ser LIDO DE LONGE E COM PRESSA: número do pedido grande,
// observações em destaque, itens com as escolhas logo abaixo. O Bruno aprova este layout (tarefa 4.8).

const FUSO = 'America/Bahia'

export const dinheiro = (centavos) =>
  `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`

const dataHora = (iso) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

/** Quebra o texto em linhas de até `largura` colunas, sem cortar palavra no meio. */
export function quebrar(texto, largura) {
  const linhas = []
  for (const paragrafo of String(texto).split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      let p = palavra
      while (p.length > largura) {
        // palavra maior que a linha: corta
        if (atual) {
          linhas.push(atual)
          atual = ''
        }
        linhas.push(p.slice(0, largura))
        p = p.slice(largura)
      }
      if (!atual) atual = p
      else if (atual.length + 1 + p.length <= largura) atual += ` ${p}`
      else {
        linhas.push(atual)
        atual = p
      }
    }
    linhas.push(atual)
  }
  return linhas
}

/** "Subtotal .......... R$ 10,00": esquerda e direita na mesma linha. */
export const duasColunas = (esquerda, direita, largura) => {
  const espaco = Math.max(1, largura - esquerda.length - direita.length)
  return `${esquerda}${' '.repeat(espaco)}${direita}`
}

const CANAIS = { proprio: 'SITE PRÓPRIO', ifood: 'IFOOD', '99food': '99FOOD' }

/**
 * Monta os bytes do recibo a partir do que a função `proxima_impressao` devolve.
 * `largura`: 48 colunas para papel de 80 mm; 32 para 58 mm.
 */
export function montarRecibo(job, { largura = 48, acentos = 'cp860', paginaDeCodigo = 3 } = {}) {
  const { pedido: p, itens } = job
  const traco = '-'.repeat(largura)
  const e = criarEscPos({ acentos, paginaDeCodigo }).iniciar()

  // Cabeçalho: número grande, tipo e canal
  e.alinhar('centro').negrito(true).tamanho(2).linha(`PEDIDO ${p.numero}`).tamanho(1)
  if (job.reimpressao) e.linha('*** REIMPRESSAO ***')
  e.linha(p.tipo === 'entrega' ? '>>> ENTREGA <<<' : '>>> RETIRADA <<<').negrito(false)
  e.linha(`${CANAIS[p.canal] ?? p.canal}  ${dataHora(p.criado_em)}`)
  e.alinhar('esquerda').linha(traco)

  // Itens
  for (const item of itens) {
    e.negrito(true).tamanho(2)
    for (const l of quebrar(`${item.quantidade}x ${item.nome}`, Math.floor(largura / 2))) e.linha(l)
    e.tamanho(1).negrito(false)
    for (const c of item.componentes) {
      const qtd = c.quantidade > 1 ? `${c.quantidade}x ` : ''
      for (const l of quebrar(`  > ${c.grupo}: ${qtd}${c.opcao}`, largura)) e.linha(l)
    }
    if (item.observacoes) {
      e.negrito(true)
      for (const l of quebrar(`  !! ${item.observacoes.toUpperCase()}`, largura)) e.linha(l)
      e.negrito(false)
    }
    e.linha()
  }

  // Observação do pedido inteiro, em destaque
  if (p.observacoes) {
    e.linha(traco).negrito(true).linha('OBSERVACAO DO PEDIDO:')
    for (const l of quebrar(p.observacoes.toUpperCase(), largura)) e.linha(l)
    e.negrito(false)
  }

  // Cliente e endereço
  e.linha(traco).negrito(true).linha(p.cliente_nome).negrito(false).linha(p.cliente_telefone)
  if (p.tipo === 'entrega' && p.endereco_rua) {
    const rua = [p.endereco_rua, p.endereco_numero].filter(Boolean).join(', ')
    for (const l of quebrar(`${rua} - ${p.endereco_bairro ?? ''}`, largura)) e.linha(l)
    if (p.endereco_complemento) e.linha(`Compl.: ${p.endereco_complemento}`)
    if (p.endereco_referencia) e.linha(`Ref.: ${p.endereco_referencia}`)
  }

  // Valores
  e.linha(traco).linha(duasColunas('Subtotal', dinheiro(p.subtotal_centavos), largura))
  if (p.taxa_entrega_centavos > 0) e.linha(duasColunas('Entrega', dinheiro(p.taxa_entrega_centavos), largura))
  if (p.desconto_centavos > 0) e.linha(duasColunas('Desconto', `-${dinheiro(p.desconto_centavos)}`, largura))
  e.negrito(true).tamanho(2)
  e.linha(duasColunas('TOTAL', dinheiro(p.total_centavos), Math.floor(largura / 2)))
  e.tamanho(1).negrito(false)
  const metodo = p.pagamento_metodo ? p.pagamento_metodo.toUpperCase() : 'PAGAMENTO'
  e.linha(`${metodo}: ${p.pagamento_status === 'pago' ? 'PAGO' : p.pagamento_status.toUpperCase()}`)

  return e.avancar(4).cortar().bytes()
}
