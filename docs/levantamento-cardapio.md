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

## Itens por categoria

Colunas: **Nome** · **Descrição** · **Preço (R$)** · **Arquivo da foto** · **Texto alternativo (alt)** · **Esgotado hoje?**

### Ofertas com Desconto

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| ? | ? | ? | ? | ? | não |

### Smashs 90g Black Angus (7 opções + "monte o seu")

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Jackfino | ? | ? | ? | ? | não |
| Laurinha | ? | ? | ? | ? | não |
| Bolado | ? | ? | ? | ? | não |
| Xeque Mate | ? | ? | ? | ? | não |
| ? (mais 3 opções) | ? | ? | ? | ? | não |
| Monte o seu Smash | ? | ? | ? | ? | não |

### Burguers 180g Black Angus (8 opções + "monte o seu")

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Padrão | ? | ? | ? | ? | não |
| Jackmelt | ? | ? | ? | ? | não |
| Boladão | ? | ? | ? | ? | não |
| Gorgonelson | ? | ? | ? | ? | não |
| ? (mais 4 opções) | ? | ? | ? | ? | não |
| Monte o seu Burguer | ? | ? | ? | ? | não |

### Entradas e Sobremesas

| Nome | Descrição | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| ? | ? | ? | ? | ? | não |

### Bebidas

| Nome | Descrição (tamanho) | Preço | Foto | alt | Esgotado? |
| --- | --- | --- | --- | --- | --- |
| Coca-Cola lata | ? | ? | ? | ? | não |
| ? | ? | ? | ? | ? | não |

## Opções dos produtos ("monte o seu", adicionais, ponto da carne…)

Para **cada produto que tem escolhas**, liste os grupos. Exemplo já preenchido para você copiar o formato:

> **Produto:** Monte o seu Smash
> | Grupo | Obrigatório? | Mínimo | Máximo | Opções (com valor extra) |
> | --- | --- | --- | --- | --- |
> | Queijo | sim | 1 | 1 | Prato (grátis), Cheddar (+ 2,00) |
> | Adicionais | não | 0 | 3 | Bacon (+ 4,00), Ovo (+ 2,50) |

Preencha o seu:

**Produto:** ?

| Grupo | Obrigatório? | Mínimo | Máximo | Opções (com valor extra) |
| --- | --- | --- | --- | --- |
| ? | ? | ? | ? | ? |

*(repita o bloco para cada produto com opções; se os adicionais forem os mesmos para todos os smashs, diga isso em vez de repetir)*

## Combos e ofertas

Para cada combo: o que vem, **o que o cliente pode escolher** (ex.: "qualquer smash da lista") e se a escolha custa mais.

| Combo | Preço | O que inclui | Escolhas do cliente |
| --- | --- | --- | --- |
| ? | ? | ? | ? |

## Perguntas em aberto (responder junto)

Marque com `[x]` e escreva a resposta ao lado.

- [ ] **Horário de funcionamento** continua quarta a domingo, 18h–22h? Alguma exceção (feriado)?
- [ ] **Pedido mínimo** para entrega? Quanto?
- [ ] **Frete (pendência P4):** como cobram hoje? Preço fixo, por km ou por bairro? Anexe a tabela/lista de bairros atendidos.
- [ ] **Raio máximo de entrega** (em km)?
- [ ] **Tempo médio** de preparo e de entrega?
- [ ] **Impressora térmica (pendência P2):** marca e modelo (está na etiqueta embaixo/atrás), como está ligada (USB, Bluetooth, rede) e em que aparelho (PC Windows? tablet Android?).
- [ ] **Endereço da loja** (para calcular distância das entregas).
- [ ] **Cashback atual (pendência P9):** os clientes da Cardápio Web têm saldo? É possível exportar a lista com os saldos?
- [ ] **Quem é o titular do CNPJ** e da conta bancária que vai receber o Pix (pendência P5)?
