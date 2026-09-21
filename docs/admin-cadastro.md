# Painel admin: cadastro de categorias e produtos

Telas em **`/admin/categorias`** e **`/admin/produtos`** (só administradores). O menu do topo do painel leva a elas.

## Como usar (Lucas / Bruno)

**Categorias**
- **Nova categoria**: nome (obrigatório), descrição (opcional). Ela entra no fim da lista.
- **▲ ▼**: mudam a ordem em que as categorias aparecem no cardápio.
- **Editar → desmarcar “Aparece no cardápio”**: esconde a categoria do cardápio sem apagar nada (os produtos continuam guardados).
- **Excluir**: só funciona se a categoria não tiver produtos. Se tiver, o sistema explica; o caminho é mudar os produtos de categoria ou só desativar.

**Produtos**
- **Novo produto**: categoria, nome, descrição, **preço em reais** (aceita `21,90`, `21.90`, `21` ou `R$ 21,90`).
- **Preço “de”** (opcional): o preço antigo que aparece riscado no cardápio. Precisa ser **maior** que o preço atual. O cliente sempre paga o preço atual.
- **Marcar esgotado**: um toque. O produto continua no cardápio, mas bloqueado e com a etiqueta “Esgotado”. Outro toque (“Voltou ao estoque”) libera. Também dá para chegar aqui pelo link **Marcar esgotado** no topo da tela da cozinha.
- **Editar → desmarcar “Aparece no cardápio”**: esconde o produto (diferente de esgotado: some de vez).
- **▲ ▼**: reordenam dentro da categoria.

## Fotos dos produtos

No **Editar** do produto (produto novo: salve primeiro): **Foto do produto** → escolher a foto (JPG, PNG ou WebP, até 15 MB). O sistema **reduz sozinho** para 1000 px e comprime (fica ~100–200 KB), então pode mandar a foto direto do celular. Trocar a foto apaga a antiga; **Remover foto** volta ao ícone padrão. A foto aparece no cardápio com o nome do produto como texto alternativo (acessibilidade).

Dica de foto boa: luz natural, fundo limpo, lanche centralizado (o cardápio mostra a foto quadrada).

## Opções do produto ("monte o seu", adicionais, combos)

No produto, o botão **Opções** abre os grupos dele:
- **Grupo** = uma pergunta ao cliente ("Ponto da carne", "Adicionais", "Escolha seu hambúrguer"). Tem **mínimo** e **máximo** de escolhas: mínimo 1 = obrigatório; mínimo 0 = opcional.
- **Opção** = uma resposta possível, com **valor adicional** opcional (ex.: Bacon + R$ 3,50).
- **Combos**: em cada opção use **"Vende qual produto?"** para apontar para o produto real (ex.: a opção "Smash" aponta para o produto Smash). É isso que faz os relatórios contarem o hambúrguer certo, e o mesmo hambúrguer nos combos e avulso.
- **Marcar esgotada**: um toque, para quando acabar um adicional.
- **Excluir** grupo/opção não altera pedidos antigos (o nome e o preço escolhidos ficam copiados no pedido).

## Configurações da loja (`/admin/loja`)

- **A loja está…**: *Seguir os horários* (normal), *Aberta agora* ou *Fechada agora*. Fechar na hora (acabou o estoque, imprevisto) é escolher “Fechada agora” e salvar; depois lembre de voltar para “Seguir os horários”.
- **Horários**: por dia da semana, com quantos intervalos precisar (almoço e jantar, por exemplo). Dia sem horário = fechado. Só o horário de Salvador vale.
- **Pedidos e entrega**: tempo de preparo (a cozinha pinta o pedido de amarelo aos 70% e de vermelho ao passar desse tempo), pedido mínimo, taxa base + valor por km, raio máximo.
- **Localização**: latitude e longitude da loja (para medir a distância da entrega). No Google Maps: botão direito no local → copiar os números.
- **Salvar** grava tudo de uma vez. Se algo estiver errado (ex.: fechar antes de abrir), a tela avisa e **nada muda**.

## Por dentro (Rafael)

- Regras puras e testadas em `app/src/domain/adminCatalogo.ts`: conversão de reais para **centavos** (nunca float, recusa mais de 2 casas e negativos), validações, reordenação.
- Acesso ao banco em `app/src/data/catalogoAdminApi.ts`. **Quem protege os dados é o RLS**: só linhas de `admins` escrevem em `categorias`/`produtos`; as telas são só conveniência. Erros do Postgres são traduzidos (`23503` em uso, `42501` sem permissão).
- Reordenar grava 10, 20, 30… (espaço para ajustes manuais).
- Configurações da loja: `app/src/domain/adminLoja.ts` (validação, sem sobreposição de horários) + função do banco `salvar_configuracao_loja` (migration `20260918190000`, testada em `supabase/tests/loja-admin.test.ts`: atomicidade, permissão, restrições). É `security invoker`: o RLS continua valendo.
- Fotos: `app/src/domain/fotos.ts` (regras), `lib/imagem.ts` (canvas), `data/fotosAdminApi.ts`; migration `20260918200000` cria o bucket e as políticas de `storage.objects` (testadas em `supabase/tests/fotos.test.ts` com um Storage mínimo simulado).
- Não altera `foto_path`, `disponivel` e `ordem` ao editar o formulário (cada um tem seu próprio caminho), então não há risco de o formulário sobrescrever o esgotado.

## Ainda falta

- Aplicar as migrations pendentes no banco de dev (1.14) — inclui `20260918200000` (fotos).
- Aplicar a migration `20260918190000` no banco de dev (1.14) antes de usar `/admin/loja`.
- Testar com o banco real: precisa de um usuário em `admins` (ver `docs/criar-admins.md`, tarefa 1.7).
