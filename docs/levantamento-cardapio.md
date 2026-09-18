# Levantamento do cardápio real (tarefa 2.1)

**Quem preenche:** Lucas (com o Bruno para receitas e descrições)
**Para que serve:** é a base do cardápio de verdade no sistema novo. Hoje o app mostra dados de exemplo inventados; assim que este arquivo estiver preenchido, o Rafael/Claude transformam em dados reais (tarefa 2.2).

## Como preencher

1. Faça uma branch: `git checkout -b docs/levantamento-cardapio`
2. Preencha as tabelas abaixo **direto neste arquivo** (pode pedir ajuda ao Claude Code: "me ajude a preencher docs/levantamento-cardapio.md a partir do cardápio atual da Cardápio Web").
3. Onde não souber, escreva `?` — melhor um `?` honesto do que um chute.
4. Salve, faça commit e abra um Pull Request (passo a passo no [CONTRIBUTING.md](../CONTRIBUTING.md)).

**Fonte:** o cardápio que já está no ar em <https://app.cardapioweb.com/deguste_burguer> e o painel da Cardápio Web (lá dá para ver descrições e preços exatos de cada item).

**Regras:**
- Preço em reais, com vírgula (ex.: `21,99`).
- Descrição como o cliente vê hoje. Não invente ingrediente.
- **Fotos não vão no Git.** Coloque num Google Drive/pasta compartilhada e anote aqui o nome do arquivo. Padrão: foto quadrada ou 4:3, de preferência com pelo menos 800 px de lado, nome sem espaço (ex.: `smash-jackfino.jpg`).
- Escreva o texto alternativo da foto (`alt`) em uma frase curta descrevendo o que aparece (ex.: "Hambúrguer smash com queijo derretido e molho"). Isso é acessibilidade: leitor de tela usa esse texto.

> **Nota desta rodada (18/09/2026):** os textos, preços e opções abaixo foram copiados diretamente do site <https://app.cardapioweb.com/deguste_burguer> (navegador, sem login) e depois **conferidos com o relatório oficial exportado do painel da Cardápio Web** (`relatorio_produtos20260918-1-oyd2d0.xlsx`, gerado em 18/09/2026 15:20, 71 produtos/insumos no total — 36 são itens de cardápio, o resto é insumo de cozinha e não entra aqui). Todos os preços e descrições bateram entre as duas fontes. A coluna **Foto** ficou `?` em todas as linhas — as fotos ainda precisam ser salvas numa pasta compartilhada (Drive) por quem tem acesso às imagens originais; não baixei nem reaproveitei as imagens do site. A coluna **alt** já vem sugerida a partir do que aparece nas fotos do site, mas vale conferir. Nenhum item apareceu marcado como esgotado durante a visita (loja estava fechada, fora do horário de funcionamento) — reconferir com a loja aberta. O relatório também mostra o **código interno** de cada produto no sistema antigo (ex.: Jackfino = `3997991`); pode ser útil na tarefa 2.2 para conferir se todo item foi migrado — não coloquei os códigos nas tabelas abaixo pra não fugir do formato pedido, mas o arquivo original está em `/home/lucas/Downloads/relatorio_produtos20260918-1-oyd2d0.xlsx` se precisar consultar.

> **Nota da 2ª rodada (18/09/2026, à tarde):** voltei ao site e abri, um por um, os modais dos 6 combos de "Ofertas com Desconto" (antes eu tinha só inferido 2 deles pelo padrão dos outros). Corrigi a seção **Combos e ofertas** com a estrutura exata de cada um — inclusive uma coisa que eu tinha perdido: os combos "3 Smashs" e "4 Smashs" também oferecem entrada/bebida/sobremesa, só que **opcionais e pagos à parte** (diferente dos outros combos, onde vêm inclusos). Também reparei que a sobremesa "Brownie de Chocolate" aparece como opção dentro dos combos mesmo estando "Inativo" no relatório — deixei uma nota pra perguntar ao Bruno.

## Itens por categoria

Colunas: **Nome** · **Descrição** · **Preço (R$)** · **Arquivo da foto** · **Texto alternativo (alt)** · **Esgotado hoje?**

### Ofertas com Desconto

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Combo Brownie Grátis | Hambúrguer suculento, batata crocante, bebida gelada e brownie grátis pra finalizar | 47,97 (de 60,96, -21%) | ? | Combo com hambúrguer, batata frita e refrigerante em lata | não |
| Combo Brownie+Bebida Grátis | 2 hambúrgueres suculentos, batata crocante + bebida grátis e brownie grátis pra fechar | 62,97 (de 83,95, -25%) | ? | Combo com dois hambúrgueres, batata frita e refrigerante em lata | não |
| Combo 3 Smashs 90g | 3 Smashs 90g Black Angus | 58,63 (de 68,97, -15%) | ? | Três hambúrgueres smash servidos numa tábua de madeira | não |
| Combo 4 Smashs 90g | 4 Smashs 90g Black Angus | 78,17 (de 91,96, -15%) | ? | Quatro hambúrgueres smash servidos numa tábua de madeira | não |
| Combo do Jackfino | Batata + Bebida + Smash 90g de Black Angus, cheddar cremoso, bacon crocante e nosso molho especial deg's sauce | 43,32 (de 50,97, -15%) | ? | Hambúrguer smash Jackfino com queijo cheddar derretido e bacon | não |
| Combo do Boladão | Batata + Bebida + Burguer 180g Black Angus, cheddar cremoso, bacon crocante, onion ring, barbecue e nossa maionese de alho (aioli) | 56,00 (de 65,97, -15%) | ? | Hambúrguer 180g com cheddar, bacon, onion ring e molho barbecue | não |

### Smashs 90g Black Angus (5 opções + "monte o seu")

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Jackfino | Smash 90g de Black Angus, cheddar cremoso, bacon crocante e nosso molho especial deg's sauce | 22,99 (de 27,99, -18%) | ? | Hambúrguer smash com cheddar derretido, bacon e molho especial | não |
| Laurinha | Smash 90g de Black Angus, queijo prato derretido, salada (cebola fininha, alface crocante e tomate), picles de pepino e nosso molho especial deg's sauce | 22,99 | ? | Hambúrguer smash tipo x-salada com alface, tomate e picles | não |
| Bolado | Smash 90g de Black Angus, cheddar cremoso, bacon crocante, onion ring e nossa maionese de alho (aioli) | 23,99 | ? | Hambúrguer smash com cheddar, bacon e anéis de cebola empanados | não |
| Xeque Mate | Smash 90g de Black Angus, queijo do reino derretido, cebola caramelizada e nossa maionese de alho (aioli) | 24,99 | ? | Hambúrguer smash com queijo do reino derretido e cebola caramelizada | não |
| Degorgson | Smash 90g de Black Angus, gorgonzola, geleia de bacon e nossa maionese de alho (aioli) | 26,99 | ? | Hambúrguer smash com gorgonzola e geleia de bacon | não |
| Monte o seu Smash (Carne e queijo 90g) | Smash 90g de Black Angus! Escolha seu queijo e molho! Tudo pode ser adicionado, para ficar do seu jeito! | 21,99 | ? | Hambúrguer smash simples com queijo, pronto para personalizar | não |

### Burguers 180g Black Angus (7 opções + "monte o seu")

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Padrão | 180g de Black Angus, queijo prato derretido, bacon crocante, cebola caramelizada e nossa maionese de alho (aioli) | 35,99 | ? | Hambúrguer 180g com queijo prato, bacon e cebola caramelizada | não |
| Jackmelt | 180g de Black Angus, cheddar cremoso, bacon crocante, cebola caramelizada e nossa maionese de alho (aioli) | 35,99 | ? | Hambúrguer 180g com cheddar derretido, bacon e cebola caramelizada | não |
| Salada | 180g de Black Angus, queijo prato derretido, salada (cebola fininha, alface crocante e tomate), picles de pepino e nosso molho especial deg's sauce | 35,99 | ? | Hambúrguer 180g tipo x-salada com alface, tomate e picles | não |
| Boladão | 180g de Black Angus, cheddar cremoso, bacon crocante, onion ring, barbecue e nossa maionese de alho (aioli) | 36,99 | ? | Hambúrguer 180g com cheddar, bacon, onion ring e molho barbecue | não |
| Diliça | 180g de Black Angus, queijo do reino derretido, geleia de bacon e nossa maionese de alho (aioli) | 37,99 | ? | Hambúrguer 180g com queijo do reino derretido e geleia de bacon | não |
| Gorgonelson | 180g de Black Angus, gorgonzola, bacon crocante, cebola caramelizada, onion ring e nossa maionese de alho (aioli) | 37,99 | ? | Hambúrguer 180g com gorgonzola, bacon, cebola caramelizada e onion ring | não |
| Baconzord | 180g de Black Angus, cheddar cremoso, bacon crocante, cebola caramelizada, picles e molho barbecue | 37,99 | ? | Hambúrguer 180g com cheddar, bacon, picles e molho barbecue | não |
| Monte o seu Burguer (Carne e queijo 180g) | 180g de Black Angus! Escolha seu queijo e molho! Tudo pode ser adicionado, para ficar do seu jeito! | 33,99 | ? | Hambúrguer 180g simples com queijo, pronto para personalizar | não |

### Entradas e Sobremesas

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Batata frita | 150g de deliciosas batatas fritas crocantes e sequinhas! | 16,99 | ? | Porção de batatas fritas crocantes | não |
| Onion Rings | Deliciosa porção com 10 anéis de cebola acompanhada de um pote de aioli | 20,99 | ? | Anéis de cebola empanados com potinho de maionese de alho | não |
| Batata Trips | 350g de deliciosas batatas fritas sequinhas e crocantes, regada com duas camadas de cheddar ou aioli e uma de bacon crocante! | 32,99 | ? | Porção grande de batatas fritas cobertas com queijo e bacon | não |
| Brownie de Ninho | Duas camadas de brownie e recheio de Ninho | 12,99 | ? | Fatia de brownie com recheio cremoso de leite Ninho | não |
| Brownie de Chocolate | Duas camadas de brownie e recheio de chocolate | 12,99 | ? | Fatia de brownie com recheio de chocolate | **inativo no sistema** (não aparece no site hoje — confirmar com o Bruno se saiu do cardápio de vez ou se é pra reativar) |
| Dois Brownies | (mesmo brownie acima, em dobro — combo com desconto) | 21,98 (de 25,98, -15%) | ? | Duas fatias de brownie com recheio de leite Ninho | não |
| Cheddar (pote) | Pote 30ml | 6,99 | ? | Pote individual de molho cheddar | não |
| Aioli (pote) | Nossa deliciosa maionese a base de alho (pote 30ml) | 2,99 | ? | Pote individual de maionese de alho | não |
| Deg's sauce (pote) | Nosso delicioso molho secreto pra smash! (Pote 30ml) | 2,99 | ? | Pote individual do molho especial da casa | não |
| Barbecue (pote) | Pote 30ml | 2,99 | ? | Pote individual de molho barbecue | não |

### Bebidas

| Nome | Descrição (tamanho) | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Coca-Cola lata | 350mL | 7,99 | ? | Lata de Coca-Cola | não |
| Coca-Cola Zero lata | 350mL | 7,99 | ? | Lata de Coca-Cola Zero | não |
| Guaraná Antarctica lata | 350mL | 7,99 | ? | Lata de Guaraná Antarctica | não |
| Guaraná Antarctica Zero lata | 350mL | 7,99 | ? | Lata de Guaraná Antarctica Zero | não |
| Água sem Gás | 500mL | 5,99 | ? | Garrafa de água sem gás | não |
| Água com Gás | 500mL | 5,99 | ? | Garrafa de água com gás | não |

## Opções dos produtos ("monte o seu", adicionais, ponto da carne…)

Para **cada produto que tem escolhas**, liste os grupos. Exemplo já preenchido para você copiar o formato:

> **Produto:** Monte o seu Smash
> | Grupo | Obrigatório? | Mínimo | Máximo | Opções (com valor extra) |
> | --- | --- | --- | --- | --- |
> | Queijo | sim | 1 | 1 | Prato (grátis), Cheddar (+ 2,00) |
> | Adicionais | não | 0 | 3 | Bacon (+ 4,00), Ovo (+ 2,50) |

**Produto:** Monte o seu Smash (90g) **e** Monte o seu Burguer (180g) — no site os dois produtos usam os mesmos grupos de opção; a única diferença é o primeiro item do grupo "Adicionais" (a carne extra), marcado abaixo.

| Grupo | Obrigatório? | Mínimo | Máximo | Opções (com valor extra) |
| --- | --- | --- | --- | --- |
| Queijo | sim | 1 | 1 | Queijo Prato (grátis), Cheddar (grátis), Queijo do Reino (+ 1,99), Creme de Gorgonzola (+ 1,99), Sem queijo (grátis) |
| Molho | sim | 1 | 2* | Sem molho (grátis), Aioli (grátis), Deg's sauce — recomendado para smash ou burguers com salada (grátis), Barbecue (grátis) |
| Adicionais | não | 0 | 10 | No Smash: Smash de 90g Black Angus extra (+ 7,50); no Burguer: Burguer de 180g Black Angus extra (+ 15,00); nos dois: Bacon (+ 4,99), Geleia de bacon (+ 5,99), Cebola caramelizada (+ 2,99), Onion ring (+ 4,99), Picles de pepino (+ 1,99), Alface americano (+ 0,99), Tomate (+ 0,99), Cebola fininha (+ 0,99) |
| Entrada (acompanhamento) | não | 0 | 1 | Batata frita (+ 14,99), Onion Rings (+ 17,99), Batata Trips com cheddar (+ 28,99), Batata Trips com aioli (+ 28,99) |
| Bebida | não | 0 | 1 | Coca-Cola Lata (+ 5,99), Coca-Cola Zero Lata (+ 5,99), Guaraná Antarctica Lata (+ 5,99), Guaraná Antarctica Zero Lata (+ 5,99), Água com Gás (+ 5,99), Água sem Gás (+ 5,99) |
| Sobremesa | não | 0 | 1 | Brownie de Ninho (+ 10,99) |

*O site mostra o contador "0 / 1" no grupo Molho mas o texto diz "Escolha de 1 a 2 opções" — parece inconsistência do próprio site da Cardápio Web. Vale confirmar com o Bruno se dá pra escolher 2 molhos ou só 1.

*(os burguers/smashs "com nome" — Jackfino, Laurinha, Padrão etc. — vêm prontos, sem esses grupos de escolha; só o "monte o seu" de cada categoria tem essas opções)*

## Combos e ofertas

Para cada combo: o que vem, **o que o cliente pode escolher** (ex.: "qualquer smash da lista") e se a escolha custa mais.

Nos combos "3 Smashs" e "4 Smashs", a entrada/bebida/sobremesa são **opcionais e pagas à parte** (upsell) — diferente dos combos "Brownie", "Jackfino" e "Boladão", onde vêm **inclusas e obrigatórias** (o cliente tem que escolher 1, mas não paga a mais por isso, salvo os itens mais caros indicados).

| Combo | Preço | O que inclui | Escolhas do cliente |
| --- | --- | --- | --- |
| Combo Brownie Grátis | 47,97 (de 60,96, -21%) | 1 hambúrguer + 1 entrada + 1 bebida + 1 sobremesa (brownie) — todos inclusos | Hambúrguer: **obrigatório**, 1 entre os 5 smashs e os 7 burguers 180g nomeados (pode repetir escolha — não se aplica aqui, é só 1 —; sabores mais caros cobram diferença, de + 1,00 até + 17,00). Entrada: **obrigatório**, 1 das 4 opções, inclusa (as maiores cobram diferença, até + 16,00). Bebida: **obrigatório**, 1 das 6 opções, inclusa, sem custo extra. Sobremesa: **obrigatório**, 1 entre Brownie de Chocolate e Brownie de Ninho, inclusa, sem custo extra. |
| Combo Brownie+Bebida Grátis | 62,97 (de 83,95, -25%) | 2 hambúrgueres + 1 entrada + 1 bebida + 1 sobremesa — todos inclusos | Conferido no modal (grupo "Hambúrguer Black Angus COMBO CASAL"). Hambúrguer: **obrigatório**, 2 entre os mesmos 12 (5 smashs + 7 burguers), **pode repetir o mesmo sabor duas vezes** (contador +/-, mesmos preços extras do combo de 1 hambúrguer). Entrada: **obrigatório**, 1 das 4, inclusa. Bebida: **obrigatório**, 1 das 6, inclusa. Sobremesa: **obrigatório**, 1 entre Brownie de Chocolate e Brownie de Ninho, inclusa. |
| Combo 3 Smashs 90g | 58,63 (de 68,97, -15%) | 3 Smashs 90g | Conferido no modal. Smashs: **obrigatório**, escolha 3 entre os 5 nomeados (Jackfino, Laurinha, Bolado, Xeque Mate, Degorgson), **pode repetir sabor** (contador +/-); os mais caros cobram diferença (+ 1,00 a + 4,00 cada). O "monte o seu" não entra como opção. Além disso, o combo oferece (**opcional, pago à parte, não incluso**): Entrada (até 1, de + 14,99 a + 28,99), Bebida (até 1, + 5,99), Sobremesa (até 1, + 10,99 — Brownie de Chocolate ou de Ninho). |
| Combo 4 Smashs 90g | 78,17 (de 91,96, -15%) | 4 Smashs 90g | Conferido no modal — mesma estrutura do combo de 3, só muda a quantidade obrigatória (4 em vez de 3). Smashs: **obrigatório**, escolha 4 entre os 5 nomeados, pode repetir sabor, mesmos adicionais de preço. Entrada/Bebida/Sobremesa: **opcionais, pagos à parte** (mesmos valores do combo de 3). |
| Combo do Jackfino | 43,32 (de 50,97, -15%) | 1 Smash Jackfino (fixo) + 1 entrada + 1 bebida — entrada e bebida inclusas | Hambúrguer é fixo (Jackfino, não dá pra trocar). Entrada: **obrigatório**, 1 das 4, inclusa (a Batata Trips cobra + 16,00). Bebida: **obrigatório**, 1 das 6, inclusa, sem custo extra. Sem grupo de sobremesa. |
| Combo do Boladão | 56,00 (de 65,97, -15%) | 1 Burguer Boladão (fixo) + 1 entrada + 1 bebida — entrada e bebida inclusas | Conferido no modal — mesma estrutura do Combo do Jackfino. Hambúrguer fixo (Boladão). Entrada: **obrigatório**, 1 das 4, inclusa. Bebida: **obrigatório**, 1 das 6, inclusa. Sem grupo de sobremesa. |

> **Nota:** em todos os combos, a opção "Brownie de Chocolate" aparece como escolha de sobremesa — mesmo ela estando marcada como **Inativo** no relatório de produtos (não aparece como item avulso no cardápio hoje). Vale perguntar ao Bruno se isso é intencional (sobremesa exclusiva de combo) ou um resquício a limpar antes de carregar os dados reais (tarefa 2.2).

## Perguntas em aberto (responder junto)

Marque com `[x]` e escreva a resposta ao lado.

- [x] **Horário de funcionamento** continua quarta a domingo, 18h–22h? Alguma exceção (feriado)? → Confirmado no site oficial (aba "Horário" do "Mais informações"): Segunda e Terça fechado; Quarta a Domingo, 18:00 às 22:00. O site não mostra nenhuma exceção de feriado — perguntar direto pro Bruno se muda em datas especiais.
- [ ] **Pedido mínimo** para entrega? Quanto? — não apareceu no que naveguei sem fazer um pedido de teste real; perguntar pro Bruno/Rafael.
- [ ] **Frete (pendência P4):** como cobram hoje? Preço fixo, por km ou por bairro? Anexe a tabela/lista de bairros atendidos. — o site pede um CEP para calcular ("Calcular taxa e tempo de entrega"), mas não testei com um CEP real (não tenho um endereço de cliente pra simular); alguém com acesso ao painel administrativo da Cardápio Web provavelmente vê a regra completa lá.
- [ ] **Raio máximo de entrega** (em km)? — mesmo motivo acima, não verificado.
- [ ] **Tempo médio** de preparo e de entrega? — não verificado.
- [ ] **Impressora térmica (pendência P2):** marca e modelo (está na etiqueta embaixo/atrás), como está ligada (USB, Bluetooth, rede) e em que aparelho (PC Windows? tablet Android?). — precisa checar fisicamente na cozinha.
- [x] **Endereço da loja** (para calcular distância das entregas). → R. José Augusto Tourinho Dantas, 506, Praia do Flamengo, Salvador/BA (retirado do rodapé do site). CNPJ encontrado junto: 59.930.646/0001-10. WhatsApp/telefone: (71) 99659-4032. Instagram: @degusteburguer_.
- [ ] **Cashback atual (pendência P9):** os clientes da Cardápio Web têm saldo? É possível exportar a lista com os saldos? — o site mostra um programa de cashback de 10% ativo pra quem cria conta, e apareceu "1 cupom disponível" na tela inicial (sem eu estar logado). Não tentei fazer login em nenhuma conta de cliente. Só o Bruno/quem administra a conta na Cardápio Web consegue ver e exportar o saldo real de cada cliente.
- [ ] **Quem é o titular do CNPJ** e da conta bancária que vai receber o Pix (pendência P5)? — o CNPJ 59.930.646/0001-10 aparece no rodapé do site, mas não o nome do titular; confirmar com o Rafael/Bruno.
