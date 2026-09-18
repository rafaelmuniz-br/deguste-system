// Pedido de EXEMPLO (mesmo formato que `proxima_impressao` devolve), usado no "teste de impressão"
// para conferir papel, acentos e layout sem precisar de um pedido de verdade.
export const pedidoDeExemplo = {
  impressao_id: '00000000-0000-4000-8000-000000000000',
  tentativa: 1,
  reimpressao: false,
  pedido: {
    numero: 123,
    criado_em: new Date().toISOString(),
    canal: 'proprio',
    tipo: 'entrega',
    cliente_nome: 'Maria da Conceição',
    cliente_telefone: '71999991234',
    endereco_rua: 'Rua José Augusto Tourinho Dantas',
    endereco_numero: '506',
    endereco_bairro: 'Praia do Flamengo',
    endereco_complemento: 'apto 201',
    endereco_referencia: 'portão azul',
    observacoes: 'tocar a campainha 2 vezes',
    pagamento_metodo: 'pix',
    pagamento_status: 'pago',
    subtotal_centavos: 5896,
    taxa_entrega_centavos: 980,
    desconto_centavos: 0,
    total_centavos: 6876,
  },
  itens: [
    {
      nome: 'Combo 3 Smashs 90g',
      quantidade: 2,
      observacoes: 'sem cebola',
      componentes: [
        { grupo: 'Smashs', opcao: 'Jackfino', quantidade: 4 },
        { grupo: 'Smashs', opcao: 'Xeque Mate', quantidade: 2 },
        { grupo: 'Bebida', opcao: 'Guaraná Antarctica Lata', quantidade: 2 },
      ],
    },
    { nome: 'Batata frita', quantidade: 1, observacoes: null, componentes: [] },
  ],
}
