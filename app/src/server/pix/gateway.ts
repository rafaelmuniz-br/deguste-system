// Porta (interface) do gateway de Pix. O resto do sistema só conhece ESTE contrato; trocar de gateway
// (Mercado Pago ⇄ Pagar.me, tarefa 3.1) é escrever outro adaptador, sem mexer em banco, telas ou regras.
// Dinheiro sempre em CENTAVOS aqui; cada adaptador converte para o formato do seu gateway.

export type PedidoParaCobranca = {
  /** UUID do pedido: usado como chave de idempotência (pedir duas vezes não cria duas cobranças). */
  pedidoId: string
  numero: number
  valorCentavos: number
  /** Minutos que o cliente tem para pagar. */
  expiraEmMinutos: number
}

export type CobrancaPix = {
  /** Identificador da cobrança no gateway. É o que o aviso de pagamento traz de volta. */
  externoId: string
  /** Código "copia e cola" (o QR é desenhado a partir dele). */
  copiaCola: string
  /** Quando a cobrança vence (ISO 8601). */
  expiraEm: string
}

export type PagamentoConsultado = {
  externoId: string
  /** Dinheiro efetivamente recebido? (o significado de "aprovado" é de cada gateway) */
  aprovado: boolean
  valorCentavos: number
  /** Status bruto do gateway, só para registro/depuração. */
  statusBruto: string
}

export type AvisoRecebido = {
  headers: Headers
  url: URL
  /** Corpo EXATAMENTE como chegou (a assinatura é calculada sobre ele). */
  corpo: string
}

export interface GatewayPix {
  readonly nome: string
  criarCobranca(pedido: PedidoParaCobranca): Promise<CobrancaPix>
  /** O aviso (webhook) veio mesmo do gateway? Nunca lança: qualquer dúvida é `false`. */
  validarAviso(aviso: AvisoRecebido): boolean
  /** Id da cobrança citada no aviso; `null` se o aviso não é sobre pagamento. */
  extrairPagamentoId(aviso: AvisoRecebido): string | null
  /** Pergunta ao gateway o estado REAL do pagamento (não confiamos no conteúdo do aviso). */
  consultarPagamento(externoId: string): Promise<PagamentoConsultado>
}
