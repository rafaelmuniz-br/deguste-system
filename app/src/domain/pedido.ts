import { precoUnitario, QUANTIDADE_MAXIMA, type Escolhas } from './carrinho.ts'
import { calcularFrete } from './frete.ts'
import { estadoLoja } from './horario.ts'
import { normalizarTelefone } from './telefone.ts'
import type { Cardapio, Produto } from './tipos.ts'

// Lógica do pedido que roda NO SERVIDOR (função `criar-pedido`, tarefa 3.7).
// O navegador só envia "o que o cliente quer" (produto, quantidade, escolhas, endereço).
// Preço, frete, total e regras (loja aberta, esgotado, mínimo, área) são calculados aqui,
// a partir do cardápio vindo do banco — nunca de valores enviados pelo cliente.

export type CodigoErro =
  | 'FORMATO_INVALIDO'
  | 'LOJA_FECHADA'
  | 'SACOLA_VAZIA'
  | 'PRODUTO_INEXISTENTE'
  | 'PRODUTO_INDISPONIVEL'
  | 'QUANTIDADE_INVALIDA'
  | 'ESCOLHA_INVALIDA'
  | 'ESCOLHAS_INSUFICIENTES'
  | 'ESCOLHAS_DEMAIS'
  | 'OPCAO_INDISPONIVEL'
  | 'NOME_INVALIDO'
  | 'TELEFONE_INVALIDO'
  | 'ENDERECO_OBRIGATORIO'
  | 'FORA_DA_AREA'
  | 'DISTANCIA_INDISPONIVEL'
  | 'PEDIDO_MINIMO'

export type ErroPedido = { codigo: CodigoErro; mensagem: string; campo?: string }

export type EnderecoEntrada = {
  rua: string
  numero: string
  bairro: string
  cidade?: string
  complemento?: string
  referencia?: string
}

export type ItemEntrada = {
  produtoId: string
  quantidade: number
  escolhas: Escolhas
  observacao?: string
}

export type PedidoEntrada = {
  cliente: { nome: string; telefone: string }
  tipo: 'entrega' | 'retirada'
  endereco?: EnderecoEntrada
  itens: ItemEntrada[]
  observacoes?: string
}

const erro = (codigo: CodigoErro, mensagem: string, campo?: string): ErroPedido => ({
  codigo,
  mensagem,
  campo,
})

// ---------------------------------------------------------------------------------------------
// 1) Leitura da entrada (JSON de origem desconhecida -> PedidoEntrada tipado)
// ---------------------------------------------------------------------------------------------

const MAX_ITENS = 30
const MAX_ESCOLHAS_POR_GRUPO = 20

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function texto(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length <= max ? t : undefined
}

export type ResultadoLeitura =
  { ok: true; entrada: PedidoEntrada } | { ok: false; erros: ErroPedido[] }

/** Confere formato e tamanhos. Não conhece preços nem cardápio (isso é o `calcularPedido`). */
export function lerEntrada(bruto: unknown): ResultadoLeitura {
  const erros: ErroPedido[] = []
  if (!ehObjeto(bruto)) {
    return { ok: false, erros: [erro('FORMATO_INVALIDO', 'Pedido em formato inválido.')] }
  }

  // Cliente
  const cliente = ehObjeto(bruto.cliente) ? bruto.cliente : {}
  const nome = texto(cliente.nome, 80)
  if (!nome || nome.length < 2) {
    erros.push(erro('NOME_INVALIDO', 'Informe seu nome.', 'cliente.nome'))
  }
  const telefone =
    typeof cliente.telefone === 'string' ? normalizarTelefone(cliente.telefone) : null
  if (!telefone) {
    erros.push(erro('TELEFONE_INVALIDO', 'Informe um telefone com DDD válido.', 'cliente.telefone'))
  }

  // Tipo e endereço
  const tipo = bruto.tipo
  if (tipo !== 'entrega' && tipo !== 'retirada') {
    erros.push(erro('FORMATO_INVALIDO', 'Escolha entrega ou retirada.', 'tipo'))
  }
  let endereco: EnderecoEntrada | undefined
  if (tipo === 'entrega') {
    const e = ehObjeto(bruto.endereco) ? bruto.endereco : {}
    const rua = texto(e.rua, 120)
    const numero = texto(e.numero, 20)
    const bairro = texto(e.bairro, 80)
    if (!rua || !numero || !bairro) {
      erros.push(
        erro('ENDERECO_OBRIGATORIO', 'Informe rua, número e bairro da entrega.', 'endereco'),
      )
    } else {
      endereco = {
        rua,
        numero,
        bairro,
        cidade: texto(e.cidade, 80) || undefined,
        complemento: texto(e.complemento, 120) || undefined,
        referencia: texto(e.referencia, 120) || undefined,
      }
    }
  }

  // Itens
  const itens: ItemEntrada[] = []
  if (!Array.isArray(bruto.itens) || bruto.itens.length === 0) {
    erros.push(erro('SACOLA_VAZIA', 'Sua sacola está vazia.', 'itens'))
  } else if (bruto.itens.length > MAX_ITENS) {
    erros.push(erro('FORMATO_INVALIDO', `No máximo ${MAX_ITENS} itens por pedido.`, 'itens'))
  } else {
    bruto.itens.forEach((it: unknown, i: number) => {
      const campo = `itens[${i}]`
      if (!ehObjeto(it) || typeof it.produtoId !== 'string' || !Number.isInteger(it.quantidade)) {
        erros.push(erro('FORMATO_INVALIDO', 'Item do pedido em formato inválido.', campo))
        return
      }
      const escolhas: Escolhas = {}
      const bruteEscolhas = it.escolhas === undefined ? {} : it.escolhas
      if (!ehObjeto(bruteEscolhas)) {
        erros.push(erro('FORMATO_INVALIDO', 'Escolhas do item em formato inválido.', campo))
        return
      }
      for (const [grupoId, ids] of Object.entries(bruteEscolhas)) {
        if (
          !Array.isArray(ids) ||
          ids.length > MAX_ESCOLHAS_POR_GRUPO ||
          !ids.every((x) => typeof x === 'string')
        ) {
          erros.push(erro('FORMATO_INVALIDO', 'Escolhas do item em formato inválido.', campo))
          return
        }
        escolhas[grupoId] = ids as string[]
      }
      const observacao = it.observacao === undefined ? '' : texto(it.observacao, 140)
      if (observacao === undefined) {
        erros.push(erro('FORMATO_INVALIDO', 'Observação do item muito longa.', campo))
        return
      }
      itens.push({
        produtoId: it.produtoId,
        quantidade: it.quantidade as number,
        escolhas,
        observacao: observacao || undefined,
      })
    })
  }

  const observacoes = bruto.observacoes === undefined ? '' : texto(bruto.observacoes, 300)
  if (observacoes === undefined) {
    erros.push(erro('FORMATO_INVALIDO', 'Observação do pedido muito longa.', 'observacoes'))
  }

  if (erros.length > 0 || !nome || !telefone || (tipo !== 'entrega' && tipo !== 'retirada')) {
    return { ok: false, erros }
  }
  return {
    ok: true,
    entrada: {
      cliente: { nome, telefone },
      tipo,
      endereco,
      itens,
      observacoes: observacoes || undefined,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// 2) Cálculo e validação de negócio
// ---------------------------------------------------------------------------------------------

export type ComponenteCalculado = {
  /** Produto real escolhido dentro do item (ex.: o hambúrguer do combo), se houver. */
  produtoId?: string
  grupoNome: string
  opcaoNome: string
  /** Unidades TOTAIS da linha (quantidade do item × 1), para somar vendas por produto direto. */
  quantidade: number
  precoAdicionalCentavos: number
}

export type ItemCalculado = {
  produtoId: string
  nome: string
  quantidade: number
  /** Produto + adicionais, por unidade. */
  precoUnitarioCentavos: number
  totalCentavos: number
  observacao?: string
  componentes: ComponenteCalculado[]
}

export type PedidoCalculado = {
  cliente: { nome: string; telefone: string }
  tipo: 'entrega' | 'retirada'
  endereco?: EnderecoEntrada
  distanciaKm?: number
  itens: ItemCalculado[]
  subtotalCentavos: number
  taxaEntregaCentavos: number
  descontoCentavos: number
  totalCentavos: number
  observacoes?: string
}

export type ContextoPedido = {
  /**
   * Cardápio lido do banco pelo servidor. Deve conter SÓ produtos/opções ativos (o que
   * está inativo não pode ser vendido).
   */
  cardapio: Cardapio
  agora: Date
  /**
   * Distância (km, por ruas) da loja até o endereço, via serviço de rotas/geocodificação.
   * Devolve null se não encontrar o endereço. Só é chamado se o pedido já estiver válido,
   * para não gastar cota de API com pedido inválido.
   */
  resolverDistanciaKm: (endereco: EnderecoEntrada) => Promise<number | null>
}

export type ResultadoPedido =
  { ok: true; pedido: PedidoCalculado } | { ok: false; erros: ErroPedido[] }

const MENSAGEM_FRETE = {
  FORA_DA_AREA: 'Ainda não entregamos nesse endereço. Que tal retirar no local?',
  DISTANCIA_INDISPONIVEL:
    'Não conseguimos localizar esse endereço para calcular a entrega. Confira os dados ou escolha retirada.',
} as const

function calcularItem(
  cardapio: Cardapio,
  item: ItemEntrada,
  indice: number,
  erros: ErroPedido[],
): ItemCalculado | null {
  const campo = `itens[${indice}]`
  const produto: Produto | undefined = cardapio.produtos.find((p) => p.id === item.produtoId)
  if (!produto) {
    erros.push(erro('PRODUTO_INEXISTENTE', 'Um dos itens não está mais no cardápio.', campo))
    return null
  }
  const antes = erros.length
  if (!produto.disponivel) {
    erros.push(erro('PRODUTO_INDISPONIVEL', `"${produto.nome}" está esgotado no momento.`, campo))
  }
  if (item.quantidade < 1 || item.quantidade > QUANTIDADE_MAXIMA) {
    erros.push(
      erro(
        'QUANTIDADE_INVALIDA',
        `A quantidade de "${produto.nome}" deve ser de 1 a ${QUANTIDADE_MAXIMA}.`,
        campo,
      ),
    )
  }

  // Grupos enviados que não existem neste produto.
  for (const grupoId of Object.keys(item.escolhas)) {
    if (!produto.grupos.some((g) => g.id === grupoId)) {
      erros.push(erro('ESCOLHA_INVALIDA', `Escolha inválida em "${produto.nome}".`, campo))
    }
  }

  const componentes: ComponenteCalculado[] = []
  for (const grupo of produto.grupos) {
    const ids = item.escolhas[grupo.id] ?? []
    if (new Set(ids).size !== ids.length) {
      erros.push(erro('ESCOLHA_INVALIDA', `Opção repetida em "${grupo.nome}".`, campo))
      continue
    }
    let validas = 0
    for (const id of ids) {
      const opcao = grupo.opcoes.find((o) => o.id === id)
      if (!opcao) {
        erros.push(erro('ESCOLHA_INVALIDA', `Opção inválida em "${grupo.nome}".`, campo))
        continue
      }
      const produtoDaOpcao = opcao.produtoId
        ? cardapio.produtos.find((p) => p.id === opcao.produtoId)
        : undefined
      const indisponivel =
        !opcao.disponivel || (opcao.produtoId !== undefined && !produtoDaOpcao?.disponivel)
      if (indisponivel) {
        erros.push(erro('OPCAO_INDISPONIVEL', `"${opcao.nome}" está esgotado no momento.`, campo))
        continue
      }
      validas++
      componentes.push({
        produtoId: opcao.produtoId,
        grupoNome: grupo.nome,
        opcaoNome: opcao.nome,
        quantidade: item.quantidade,
        precoAdicionalCentavos: opcao.precoAdicionalCentavos,
      })
    }
    if (validas < grupo.minEscolhas) {
      erros.push(
        erro(
          'ESCOLHAS_INSUFICIENTES',
          `Escolha as opções de "${grupo.nome}" em "${produto.nome}".`,
          campo,
        ),
      )
    }
    if (ids.length > grupo.maxEscolhas) {
      erros.push(
        erro('ESCOLHAS_DEMAIS', `"${grupo.nome}" aceita no máximo ${grupo.maxEscolhas}.`, campo),
      )
    }
  }

  if (erros.length > antes) return null
  const unitario = precoUnitario(produto, item.escolhas)
  return {
    produtoId: produto.id,
    nome: produto.nome,
    quantidade: item.quantidade,
    precoUnitarioCentavos: unitario,
    totalCentavos: unitario * item.quantidade,
    observacao: item.observacao,
    componentes,
  }
}

/**
 * Valida o pedido contra o cardápio/loja e calcula preços e frete.
 * Devolve TODOS os problemas de uma vez (para o cliente corrigir de uma só vez) ou o pedido pronto.
 */
export async function calcularPedido(
  entrada: PedidoEntrada,
  ctx: ContextoPedido,
): Promise<ResultadoPedido> {
  const { cardapio, agora } = ctx
  const { loja } = cardapio
  const erros: ErroPedido[] = []

  if (!estadoLoja(loja, agora).aberta) {
    erros.push(erro('LOJA_FECHADA', 'A loja está fechada no momento.'))
  }

  const itens: ItemCalculado[] = []
  entrada.itens.forEach((item, i) => {
    const calculado = calcularItem(cardapio, item, i, erros)
    if (calculado) itens.push(calculado)
  })
  if (entrada.itens.length === 0) erros.push(erro('SACOLA_VAZIA', 'Sua sacola está vazia.'))

  const subtotalCentavos = itens.reduce((soma, it) => soma + it.totalCentavos, 0)
  if (erros.length === 0 && subtotalCentavos < loja.pedidoMinimoCentavos) {
    erros.push(
      erro(
        'PEDIDO_MINIMO',
        `O pedido mínimo é de R$ ${(loja.pedidoMinimoCentavos / 100).toFixed(2).replace('.', ',')}.`,
      ),
    )
  }

  // Frete: só consulta o serviço de rotas se o resto já está válido.
  let taxaEntregaCentavos = 0
  let distanciaKm: number | undefined
  if (entrada.tipo === 'entrega') {
    if (!entrada.endereco) {
      erros.push(erro('ENDERECO_OBRIGATORIO', 'Informe o endereço da entrega.', 'endereco'))
    } else if (erros.length === 0) {
      const precisaDistancia = loja.entrega.regra.tipo !== 'por_bairro'
      const km = precisaDistancia ? await ctx.resolverDistanciaKm(entrada.endereco) : null
      const frete = calcularFrete(loja.entrega, {
        distanciaKm: km ?? undefined,
        bairro: entrada.endereco.bairro,
      })
      if (frete.ok) {
        taxaEntregaCentavos = frete.taxaCentavos
        distanciaKm = frete.distanciaKm
      } else {
        erros.push(erro(frete.motivo, MENSAGEM_FRETE[frete.motivo], 'endereco'))
      }
    }
  }

  if (erros.length > 0) return { ok: false, erros }

  const descontoCentavos = 0 // cupons e cashback entram na Fase 6
  return {
    ok: true,
    pedido: {
      cliente: entrada.cliente,
      tipo: entrada.tipo,
      endereco: entrada.tipo === 'entrega' ? entrada.endereco : undefined,
      distanciaKm,
      itens,
      subtotalCentavos,
      taxaEntregaCentavos,
      descontoCentavos,
      totalCentavos: subtotalCentavos + taxaEntregaCentavos - descontoCentavos,
      observacoes: entrada.observacoes,
    },
  }
}
