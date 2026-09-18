import type { Cardapio, GrupoOpcao, Produto } from '../domain/tipos.ts'

// DADOS DE EXEMPLO para desenvolvimento. Os nomes seguem o cardápio público observado
// no levantamento (planejamento), mas descrições e preços exatos são PLACEHOLDERS até a
// tarefa 2.1 (levantar o cardápio real). Nada aqui vai para produção.

const CAT = {
  ofertas: 'cat-ofertas',
  smash: 'cat-smash',
  burguer: 'cat-burguer',
  entradas: 'cat-entradas',
  bebidas: 'cat-bebidas',
}

const grupoAdicionais = (id: string): GrupoOpcao => ({
  id: `${id}-adicionais`,
  nome: 'Adicionais',
  minEscolhas: 0,
  maxEscolhas: 3,
  opcoes: [
    { id: `${id}-bacon`, nome: 'Bacon extra', precoAdicionalCentavos: 400, disponivel: true },
    { id: `${id}-queijo`, nome: 'Queijo extra', precoAdicionalCentavos: 300, disponivel: true },
    { id: `${id}-ovo`, nome: 'Ovo', precoAdicionalCentavos: 250, disponivel: true },
    {
      id: `${id}-cebola`,
      nome: 'Cebola caramelizada',
      precoAdicionalCentavos: 300,
      disponivel: true,
    },
    { id: `${id}-picles`, nome: 'Picles', precoAdicionalCentavos: 200, disponivel: false },
  ],
})

const smash = (
  id: string,
  nome: string,
  precoCentavos: number,
  descricao: string,
  precoOriginalCentavos?: number,
): Produto => ({
  id,
  categoriaId: CAT.smash,
  nome,
  descricao,
  precoCentavos,
  precoOriginalCentavos,
  ehCombo: false,
  disponivel: true,
  grupos: [grupoAdicionais(id)],
})

const burguer = (id: string, nome: string, precoCentavos: number, descricao: string): Produto => ({
  id,
  categoriaId: CAT.burguer,
  nome,
  descricao,
  precoCentavos,
  ehCombo: false,
  disponivel: true,
  grupos: [
    {
      id: `${id}-ponto`,
      nome: 'Ponto da carne',
      minEscolhas: 1,
      maxEscolhas: 1,
      opcoes: [
        { id: `${id}-ao-ponto`, nome: 'Ao ponto', precoAdicionalCentavos: 0, disponivel: true },
        {
          id: `${id}-bem-passado`,
          nome: 'Bem passado',
          precoAdicionalCentavos: 0,
          disponivel: true,
        },
      ],
    },
    grupoAdicionais(id),
  ],
})

const produtos: Produto[] = [
  // --- Ofertas com desconto (combos: cada escolha aponta para um produto REAL) ---
  {
    id: 'combo-smash',
    categoriaId: CAT.ofertas,
    nome: 'Combo Smash + Batata + Refri',
    descricao: 'Escolha seu smash, batata frita e uma lata.',
    precoCentavos: 3999,
    ehCombo: true,
    disponivel: true,
    grupos: [
      {
        id: 'combo-smash-hamburguer',
        nome: 'Escolha seu smash',
        minEscolhas: 1,
        maxEscolhas: 1,
        opcoes: [
          {
            id: 'cs-jackfino',
            nome: 'Jackfino',
            precoAdicionalCentavos: 0,
            produtoId: 'smash-jackfino',
            disponivel: true,
          },
          {
            id: 'cs-laurinha',
            nome: 'Laurinha',
            precoAdicionalCentavos: 0,
            produtoId: 'smash-laurinha',
            disponivel: true,
          },
          {
            id: 'cs-xeque',
            nome: 'Xeque Mate',
            precoAdicionalCentavos: 400,
            produtoId: 'smash-xeque-mate',
            disponivel: true,
          },
        ],
      },
      {
        id: 'combo-smash-bebida',
        nome: 'Escolha a bebida',
        minEscolhas: 1,
        maxEscolhas: 1,
        opcoes: [
          {
            id: 'cs-coca',
            nome: 'Coca-Cola lata',
            precoAdicionalCentavos: 0,
            produtoId: 'beb-coca',
            disponivel: true,
          },
          {
            id: 'cs-guarana',
            nome: 'Guaraná lata',
            precoAdicionalCentavos: 0,
            produtoId: 'beb-guarana',
            disponivel: true,
          },
        ],
      },
    ],
  },

  // --- Smashs 90g ---
  smash(
    'smash-jackfino',
    'Jackfino',
    2199,
    'Smash 90g Black Angus, queijo e molho da casa.',
    2799, // igual ao desconto real do site hoje (tarefa 2.12)
  ),
  smash('smash-laurinha', 'Laurinha', 2299, 'Smash 90g Black Angus, queijo prato e cebola.'),
  smash('smash-bolado', 'Bolado', 2499, 'Smash 90g Black Angus, bacon crocante e cheddar.'),
  smash(
    'smash-xeque-mate',
    'Xeque Mate',
    2699,
    'Smash 90g Black Angus duplo, queijo e molho especial.',
  ),
  {
    id: 'smash-monte',
    categoriaId: CAT.smash,
    nome: 'Monte o seu Smash',
    descricao: 'Comece pelo básico e escolha seus adicionais.',
    precoCentavos: 2199,
    ehCombo: false,
    disponivel: true,
    grupos: [
      {
        id: 'smash-monte-queijo',
        nome: 'Queijo',
        minEscolhas: 1,
        maxEscolhas: 1,
        opcoes: [
          { id: 'sm-prato', nome: 'Prato', precoAdicionalCentavos: 0, disponivel: true },
          { id: 'sm-cheddar', nome: 'Cheddar', precoAdicionalCentavos: 200, disponivel: true },
        ],
      },
      grupoAdicionais('smash-monte'),
    ],
  },

  // --- Burguers 180g ---
  burguer('burguer-padrao', 'Padrão', 3399, 'Burguer 180g Black Angus, queijo, alface e tomate.'),
  burguer('burguer-jackmelt', 'Jackmelt', 3599, 'Burguer 180g Black Angus com queijo derretido.'),
  burguer('burguer-boladao', 'Boladão', 3799, 'Burguer 180g Black Angus, bacon e cheddar.'),
  burguer('burguer-gorgonelson', 'Gorgonelson', 3799, 'Burguer 180g Black Angus com gorgonzola.'),

  // --- Entradas e sobremesas ---
  {
    id: 'ent-batata',
    categoriaId: CAT.entradas,
    nome: 'Batata frita',
    descricao: 'Porção individual.',
    precoCentavos: 1500,
    ehCombo: false,
    disponivel: true,
    grupos: [],
  },
  {
    id: 'ent-onion',
    categoriaId: CAT.entradas,
    nome: 'Onion rings',
    descricao: 'Porção com 8 anéis.',
    precoCentavos: 1800,
    ehCombo: false,
    disponivel: true,
    grupos: [],
  },
  {
    id: 'ent-brownie',
    categoriaId: CAT.entradas,
    nome: 'Brownie',
    descricao: 'Exemplo de produto esgotado.',
    precoCentavos: 1400,
    ehCombo: false,
    disponivel: false,
    grupos: [],
  },

  // --- Bebidas ---
  {
    id: 'beb-coca',
    categoriaId: CAT.bebidas,
    nome: 'Coca-Cola lata',
    descricao: '350ml',
    precoCentavos: 600,
    ehCombo: false,
    disponivel: true,
    grupos: [],
  },
  {
    id: 'beb-guarana',
    categoriaId: CAT.bebidas,
    nome: 'Guaraná lata',
    descricao: '350ml',
    precoCentavos: 600,
    ehCombo: false,
    disponivel: true,
    grupos: [],
  },
  {
    id: 'beb-agua',
    categoriaId: CAT.bebidas,
    nome: 'Água mineral',
    descricao: '500ml',
    precoCentavos: 400,
    ehCombo: false,
    disponivel: true,
    grupos: [],
  },
]

export const cardapioExemplo: Cardapio = {
  categorias: [
    { id: CAT.ofertas, nome: 'Ofertas com Desconto', ordem: 1 },
    { id: CAT.smash, nome: 'Smashs 90g Black Angus', ordem: 2 },
    { id: CAT.burguer, nome: 'Burguers 180g Black Angus', ordem: 3 },
    { id: CAT.entradas, nome: 'Entradas e Sobremesas', ordem: 4 },
    { id: CAT.bebidas, nome: 'Bebidas', ordem: 5 },
  ],
  produtos,
  loja: {
    nome: 'Deguste Burguer',
    fusoHorario: 'America/Bahia',
    modo: 'automatico',
    pedidoMinimoCentavos: 0,
    tempoPreparoMin: 30,
    // Igual ao seed de desenvolvimento (regra final: pendência P4).
    entrega: { regra: { tipo: 'por_km', baseCentavos: 500, porKmCentavos: 150 }, raioMaximoKm: 6 },
    // Quarta (3) a domingo (0), 18h às 22h — igual ao padrão das migrations.
    horarios: [3, 4, 5, 6, 0].map((diaSemana) => ({ diaSemana, abre: '18:00', fecha: '22:00' })),
  },
}
