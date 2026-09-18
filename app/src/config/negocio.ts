// Dados públicos do negócio, usados no rodapé e nas páginas legais. Fonte única: se algo mudar
// (endereço, telefone, canal de privacidade), muda aqui e vale em todo o site.
//
// Origem: rodapé público do cardápio atual (Cardápio Web), conforme o levantamento do Lucas
// (docs/levantamento-cardapio.md). Nada aqui é segredo.

export const NEGOCIO = {
  nome: 'Deguste Burguer',
  cnpj: '59.930.646/0001-10',
  endereco: 'R. José Augusto Tourinho Dantas, 506, Praia do Flamengo, Salvador/BA',
  whatsapp: '(71) 99659-4032',
  whatsappLink: 'https://wa.me/5571996594032',
  instagram: '@degusteburguer_',
  instagramLink: 'https://www.instagram.com/degusteburguer_/',
  horario: 'quarta a domingo, das 18h às 22h',

  // ---- Itens que dependem de DECISÃO do negócio. `null` aparece destacado como "[a definir]"
  // ---- nas páginas e o site avisa que o texto é rascunho (ver CONTEUDO_LEGAL_REVISADO).
  /** Razão social exata, como está no cartão CNPJ. */
  razaoSocial: null as string | null,
  /** Canal para o cliente exercer direitos da LGPD (e-mail ou WhatsApp). Tarefa 3.13. */
  canalPrivacidade: null as string | null,
  /** Quem responde pela proteção de dados (encarregado). Pode ser o próprio dono. */
  encarregado: null as string | null,
  /** Gateway que processa o Pix (Mercado Pago ou Pagar.me). Tarefa 3.1. */
  gatewayPix: null as string | null,
  /** Prazo para o reembolso cair, depois de aprovado. */
  prazoReembolso: null as string | null,
  /** Até quando o cliente pode avisar de problema no pedido (item errado, faltando...). */
  prazoReclamacao: null as string | null,
}

/** Data da última revisão do texto das páginas legais. */
export const LEGAL_ATUALIZADO_EM = '18 de setembro de 2026'

/**
 * TRAVA de segurança: enquanto for `false`, todas as páginas legais mostram o aviso
 * "rascunho, aguardando revisão". Só vire para `true` depois que (1) um profissional jurídico
 * ou pessoa responsável revisar e (2) todos os "[a definir]" forem preenchidos acima.
 * Há um teste que falha se for `true` e ainda restar "[a definir]" na tela.
 */
export const CONTEUDO_LEGAL_REVISADO = false
