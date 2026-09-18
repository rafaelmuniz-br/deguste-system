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

## Por dentro (Rafael)

- Regras puras e testadas em `app/src/domain/adminCatalogo.ts`: conversão de reais para **centavos** (nunca float, recusa mais de 2 casas e negativos), validações, reordenação.
- Acesso ao banco em `app/src/data/catalogoAdminApi.ts`. **Quem protege os dados é o RLS**: só linhas de `admins` escrevem em `categorias`/`produtos`; as telas são só conveniência. Erros do Postgres são traduzidos (`23503` em uso, `42501` sem permissão).
- Reordenar grava 10, 20, 30… (espaço para ajustes manuais).
- Não altera `foto_path`, `disponivel` e `ordem` ao editar o formulário (cada um tem seu próprio caminho), então não há risco de o formulário sobrescrever o esgotado.

## Ainda falta

- Foto do produto (1.11) e grupos de opção / “monte o seu” (1.10) e configurações da loja (1.12).
- Testar com o banco real: precisa de um usuário em `admins` (ver `docs/criar-admins.md`, tarefa 1.7).
