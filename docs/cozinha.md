# Painel da cozinha

Tela em **`/cozinha`** (só para administradores). Feita para tablet ou PC na cozinha, com botões grandes.

## Como usar (Bruno / equipe)

1. Entre com o e-mail e a senha de administrador.
2. Toque em **🔕 Ativar som** uma vez (o navegador só libera áudio depois de um toque). A escolha fica lembrada.
3. Os pedidos **pagos** aparecem em três colunas: **Novos → Em preparo → Prontos / a caminho**.
4. Cada cartão tem um botão grande com o **próximo passo** (Aceitar e preparar → Pronto → Saiu para entrega / Entregue ao cliente → Entregue). Não dá para pular etapas nem voltar.
5. **Recusar/Cancelar** pede um motivo (fica gravado no pedido). Se o cliente já pagou, será preciso devolver o valor.
6. **Reimprimir** manda o pedido de novo para a impressora (o recibo sai marcado como reimpressão).
7. **Marcar esgotado** (topo da tela) leva à lista de produtos, onde um toque bloqueia o produto no cardápio ([`admin-cadastro.md`](admin-cadastro.md)).
8. Pedidos de entrega têm **Rota no mapa** (Google Maps), **Waze** e **Enviar ao entregador (WhatsApp)**: abre o WhatsApp para escolher o contato do entregador, com a mensagem pronta (número do pedido, nome e telefone do cliente, endereço, referência e link da rota — sem valores nem itens).

## O que a tela avisa sozinha

| Situação | O que aparece |
| --- | --- |
| Pedido novo | Três bipes, repetidos a cada 20 s enquanto houver pedido novo sem atendimento |
| Pedido demorando | Cartão amarelo a partir de 70% do tempo de preparo (30 min); vermelho e "ATRASADO" depois disso |
| Internet/tempo real caiu | Faixa vermelha "Sem tempo real: atualizando a cada 15 s" |
| Não conseguiu consultar o banco | Aviso "pode estar desatualizado"; os pedidos que já estavam na tela continuam visíveis |
| Pedido não saiu impresso | Faixa "N pedidos não saíram impressos", com botão **Reimprimir** |
| Pix caiu depois do pedido cancelado/expirado, ou com valor diferente | Faixa "N pagamentos precisam de conferência": diz o pedido e o valor. **Devolva o dinheiro no painel do gateway** e toque em **Já resolvi** (ver `docs/pagamento.md`) |
| Outra pessoa mexeu no mesmo pedido | "O pedido X já foi alterado por outra pessoa. Atualizei a tela." |

## Como funciona por dentro (Rafael / Lucas)

- Regras puras e testadas em `app/src/domain/cozinha.ts` (colunas, próxima ação, atraso, link de rota).
- Acesso ao banco em `app/src/data/cozinhaApi.ts`: lê `pedidos` pagos em andamento (RLS: só admin), muda status com `.eq('status', <status esperado>)` — se ninguém foi atualizado, é conflito, e ninguém sobrescreve o trabalho de outro.
- **Tempo real**: canal Supabase Realtime em `pedidos` e `impressoes`. Vários eventos seguidos viram uma consulta só (espera de 300 ms). Rede de segurança: consulta a cada 15 s e quando a aba volta a ficar visível.
- Som: `app/src/state/useAlertaSonoro.ts` (Web Audio; se o aparelho não tiver áudio, a tela continua avisando visualmente).
- Login/permissão: `app/src/components/PortaoAdmin.tsx`, o mesmo portão do `/admin` (sessão + linha na tabela `admins`).

## Para funcionar no banco de DEV

Precisa das migrations `150000`–`180000` aplicadas (ver `docs/migrations-aplicadas.md`, tarefa 1.14) e de um usuário na tabela `admins` (`docs/criar-admins.md`). Realtime precisa estar habilitado para as tabelas `pedidos` e `impressoes` (Supabase → Database → Replication).

## Ainda falta

- Teste em tablet real e com internet caindo (4.13).
