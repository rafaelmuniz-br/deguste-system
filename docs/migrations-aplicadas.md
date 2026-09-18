# Migrations: o que já foi aplicado em cada banco

O repositório é a fonte da verdade (`supabase/migrations/`), mas **quem aplica no Supabase é uma pessoa** (hoje o Lucas). Esta lista existe para ninguém esquecer nada: quando uma migration nova entra na `main`, ela aparece aqui como pendente até ser aplicada.

**Como aplicar:** Supabase → SQL Editor → cole o arquivo inteiro → Run. Rode **em ordem** e **uma vez só** cada uma. Depois marque aqui (PR com `Fecha: nenhuma`).

| Migration | O que faz | `deguste-dev` | `deguste-prod` |
| --- | --- | --- | --- |
| `20260918120000_cardapio_e_loja` | Tabelas do cardápio e da loja | ✅ | ⬜ |
| `20260918120100_pedidos_e_clientes` | Pedidos, itens e clientes | ✅ | ⬜ |
| `20260918120200_reservado_cupons_cashback` | Cupons e cashback (reservado) | ✅ | ⬜ |
| `20260918120300_rls` | Segurança (RLS) de todas as tabelas | ✅ | ⬜ |
| `20260918130000_comentarios_pedido` | Comentários de colunas | ✅ | ⬜ |
| `20260918140000_preco_original_produto` | Preço "de/por" | ✅ | ⬜ |
| `20260918150000_comentario_componentes_repeticoes` | Comentário de coluna | **⬜ pendente** | ⬜ |
| `20260918160000_pedido_atomico` | `criar_pedido`, `acompanhar_pedido`, token e anti-spam | **⬜ pendente** | ⬜ |
| `20260918170000_lgpd_direitos_do_titular` | `exportar_dados_cliente` e `anonimizar_cliente` | **⬜ pendente** | ⬜ |
| `20260918180000_fila_de_impressao` | Fila de impressão, agente e reimpressão | **⬜ pendente** | ⬜ |
| `20260918190000_salvar_configuracao_loja` | Função que salva configuração e horários da loja de uma vez | **⬜ pendente** | ⬜ |
| `20260918200000_fotos_produtos` | Bucket público `fotos-produtos` e permissões (só admin envia) | **⬜ pendente** | ⬜ |

O `deguste-prod` ainda não existe (tarefa 0.7); quando existir, aplicar **todas** as migrations em ordem.

> Depois de aplicar uma migration nova, o teste do banco (`supabase/`) já a cobre; o que muda é só o banco real ficar igual ao repositório.
