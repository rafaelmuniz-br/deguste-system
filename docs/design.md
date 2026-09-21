# Design da interface (redesign de 21/09/2026)

Transformação **visual** do app: mesma estrutura, mesmas telas, mesmas regras e mesmo fluxo; nova linguagem de app de delivery moderno, **na paleta preto e branco da Deguste**. Inspiração: os padrões do segmento (hierarquia, cartões de produto, barra de sacola, folhas que sobem de baixo), sem copiar marca, texto, logotipo nem componentes de nenhuma plataforma.

## Princípios

1. **A comida é a protagonista:** imagem → nome → descrição → preço → ação. O cartão do produto tem a foto grande à direita com um botão **+** sobre ela.
2. **Tema claro fixo** (decisão do Rafael, 21/09/2026): o site não muda de cor pelo modo escuro do aparelho; um teste garante que nenhum CSS reintroduza isso.
3. **Preto é a cor de ação** (botões, "+", barra da sacola, categoria em destaque); branco e cinzas neutros para o resto. Cores só para **significado**: verde (aberto, desconto), vermelho (fechado, esgotado, erro).
4. **Alto contraste e leitura rápida:** títulos em peso 800, texto em cinza-grafite, informação secundária em cinza médio.
5. **Formas consistentes:** cantos arredondados (14 px cartões, círculo nos botões de quantidade, pílula em busca/categorias/estado), sombras discretas.
6. **Mobile primeiro:** folhas (modais) sobem de baixo no celular e viram janela centralizada no computador; a lista vira 2 colunas a partir de 760 px.

## O que mudou na tela

| Área | Antes | Agora |
| --- | --- | --- |
| Cabeçalho | Título e selo em faixa branca | Capa preta com a marca, avatar "D" sobreposto, nome, estado da loja e tempo de preparo em "chips" |
| Busca e categorias | Campo retangular e botões pequenos | Busca em pílula com lupa; categorias em chips que rolam de lado; fixas ao rolar |
| Produto | Cartão com foto pequena | Cartão com foto 104 px, descrição em até 3 linhas, preço em destaque, "de/por" com selo verde, botão "+" |
| Sem foto | Ícone solto sobre fundo colorido | Bloco escuro da marca (ícone em tons de cinza), para o cardápio parecer completo mesmo antes das fotos |
| Sacola | Barra colada na base | Barra preta flutuante com quantidade e total |
| Modal | Janela simples | Folha com "alça", cantos superiores de 24 px, opção selecionada com contorno preto, rodapé fixo com quantidade e botão |
| Fonte | Fonte do sistema | **Inter** (embutida no site: nenhum pedido a serviço de terceiros, coerente com a política de privacidade) |
| Tema | Seguia o modo escuro do aparelho | **Sempre claro** |
| Ícone da aba | Logotipo padrão do Vite | Marca "D" preta |

Preservado: textos, dados, rotas, regras de preço/frete, carrinho, Pix, acompanhamento, painel admin e cozinha (que herdam as mesmas cores).

## Como está organizado (para quem for mexer)

- **Tudo é dirigido por variáveis de cor** em `app/src/cardapio.css` (bloco `:root`; não há tema escuro): `--bg`, `--superficie`, `--texto`, `--muted`, `--borda`, `--borda-campo`, `--acento` (o preto de ação), `--sobre-acento`, `--acento-suave`, `--ok-*`, `--fechado-*`, `--foco`, mais `--raio`, `--raio-pequeno`, `--sombra`, `--sombra-forte`. Mudar a identidade visual é mudar estas variáveis.
- **Acessibilidade continua garantida por teste:** `app/src/test/contraste.test.ts` lê essas variáveis e confere WCAG AA no tema claro (texto 4,5:1; bordas e foco 3:1); `acessibilidade.test.tsx` roda o axe nas telas. Se trocar uma cor, o teste avisa se ficou ilegível.
- Campos de formulário mantêm a **borda visível** (`--borda-campo`, 3:1) mesmo no estilo "chip": é regra de acessibilidade do projeto.
- Componentes: `ProdutoCard` (foto + "+"), cabeçalho em `Cardapio.tsx` (capa/avatar/chips), `ProdutoModal` (mostra a foto grande quando existe), folhas em `Modal.tsx`.

## Medição depois do redesign

Lighthouse mobile (build de produção local): **desempenho 96**, acessibilidade 100, boas práticas 100, SEO 100; deslocamento de layout 0,001. A fonte adiciona ~48 kB (só o subconjunto latino é baixado).

## Ainda falta / ideias

- **Fotos reais dos produtos** (2.13): o cartão foi desenhado para elas; o efeito completo só aparece com as fotos.
- Ícone da marca em alta resolução e o logotipo oficial (hoje a capa usa o nome em texto); a "capa" pode virar uma foto da loja.
- Categoria destacada conforme a rolagem (como nos apps de delivery) e cartões de "destaques" no topo.
- Linha do tempo do pedido com ícones por etapa.
