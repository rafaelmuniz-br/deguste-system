# Deguste Burguer — instruções para o Claude Code

Sistema próprio de pedidos de uma hamburgueria pequena (~33 pedidos/dia, quarta a domingo, 18h–22h) que substitui a Cardápio Web. Fonte de verdade do escopo: `Sistema-Deguste-Burguer-Planejamento.md`. Ordem e status das tarefas: `PLANO-DE-PRODUCAO.md`.

Quem usa: Bruno (chef), Lucas (administrador, **iniciante em programação**) e Rafael (CTO, revisa todos os PRs). Explique mudanças em português, de forma clara, sem jargão desnecessário.

## Stack

React + Vite + TypeScript + React Router (sem framework tipo Next), Netlify Functions (`app/netlify/functions`), Supabase (Postgres, Auth, Realtime, Storage), Pix via gateway (Mercado Pago ou Pagar.me, ainda a decidir), agente de impressão Node.js (`printer-agent/`).

## Comandos (rodar dentro de `app/`)

`npm run dev` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run format` · `npm run build`

Antes de dizer que algo está pronto: lint, typecheck, testes e build passando. Mexeu em `supabase/`? Rode também `npm test` dentro de `supabase/` (aplica as migrations num Postgres em memória e testa RLS e integridade).

## Regras do projeto

- **Git:** nunca commitar em `main`. Uma branch por tarefa (`feat/`, `fix/`, `docs/`), PR pequeno, referenciando o ID da tarefa do plano. Ao concluir uma tarefa, marcar `[x]` no `PLANO-DE-PRODUCAO.md`.
- **Plano de produção:** toda tarefa em `PLANO-DE-PRODUCAO.md` termina com `` `👤 Responsável` `` (ex.: `👤 Lucas + Bruno`) e, se houver, `` `⏳ depende: 1.7` ``. Ao criar tarefa nova, siga esse formato (o painel em `painel/` lê essas etiquetas). Pendências entram na tabela da seção 8. **Todo PR que conclui tarefa marca `[x]` no plano no próprio PR e traz `Fecha: X.Y` na descrição** (o CI `plano` confere; rode `node scripts/verificar-plano.mjs` antes de abrir o PR).
- **Tarefas do Rafael:** o Lucas está autorizado (21/09/2026) a assumir tarefas marcadas `👤 Rafael`: troque o responsável no plano para `👤 Lucas`, faça por PR e o Rafael revisa e mescla. **Nunca** mexa em permissões/ruleset do GitHub, no Netlify (0.6/5.16), em segredos (service_role, chaves do gateway) nem decida regras de negócio (gateway em 3.1, pagamento em 3.16): prepare rascunhos e pergunte ao Rafael.
- **Segredos:** nunca no código, em commit, em log ou em `.env.example`. `VITE_*` é público (vai para o navegador) — só a chave `anon` do Supabase pode ter esse prefixo. Service role e chaves do gateway ficam só em Netlify Functions, lidas de variáveis de ambiente.
- **Dinheiro:** preço, frete, desconto e total são calculados **no servidor** a partir do banco; nunca confiar em valores enviados pelo navegador. Valores monetários em **centavos (inteiros)**, nunca float. Webhooks de pagamento devem ser idempotentes e validar assinatura.
- **Banco:** schema só por migrations em `supabase/migrations/` (nomes `AAAAMMDDHHMMSS_descricao.sql`). **RLS ativado em toda tabela**; toda tabela nova precisa de política explícita. Nunca alterar schema direto no painel do Supabase.
- **Modelo de dados:** todo item de pedido aponta para um `produto_id` real, mesmo dentro de combo, e todo pedido tem `canal` (`proprio`, `ifood`, `99food`). Isso garante relatórios corretos entre combos e canais.
- **Ambientes:** desenvolvimento local usa sempre o Supabase de DEV, nunca produção. **Por decisão do Rafael (21/09/2026), o Netlify fica para o FINAL do projeto (tarefa 5.16):** até lá tudo roda em **localhost** (site, functions e testes), sem deploy preview; não tente configurar Netlify, domínio ou deploy fora dessa tarefa.
- **Fuso:** horários de funcionamento e relatórios em `America/Bahia`.
- **Acessibilidade:** `alt` em toda foto de produto, contraste adequado, formulários usáveis por teclado, mobile-first (a maioria dos clientes usa celular).
- **LGPD:** coletar só o necessário (nome, telefone, endereço); nada de cookies de terceiros sem declarar na política de privacidade.
- **Texto para o usuário final:** português do Brasil.

## Estilo de código

TypeScript estrito, sem `any` sem justificativa. Prettier (sem ponto e vírgula, aspas simples). Componentes funcionais. Testes com Vitest + Testing Library; toda regra de preço, frete e pagamento precisa de teste.
