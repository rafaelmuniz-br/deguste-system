# Sistema Deguste Burguer

Plataforma própria da Deguste Burguer (Salvador/BA) para substituir a Cardápio Web: cardápio digital, pedidos, Pix, cozinha em tempo real e impressão automática.

- Planejamento: [Sistema-Deguste-Burguer-Planejamento.md](Sistema-Deguste-Burguer-Planejamento.md)
- **Plano de produção e progresso:** [PLANO-DE-PRODUCAO.md](PLANO-DE-PRODUCAO.md)

## Como rodar em 10 minutos

Pré-requisitos: [Node.js](https://nodejs.org) 22 ou mais novo e [Git](https://git-scm.com).

```bash
git clone https://github.com/rafaelmuniz-br/deguste-system.git
cd deguste-system/app
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase de DEV (peça ao Rafael)
npm run dev                  # abre em http://localhost:5173
```

Comandos úteis (dentro de `app/`):

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Roda os testes |
| `npm run lint` | Procura problemas no código |
| `npm run typecheck` | Confere os tipos TypeScript |
| `npm run format` | Formata o código |
| `npm run build` | Gera a versão de produção |

Testes do banco (RLS e regras de integridade), dentro de `supabase/`: `npm install && npm test`.

## Acompanhar o progresso em uma página

```bash
node painel/server.js   # abre em http://localhost:4173
```

Na aba **Minhas tarefas** escolha seu nome (Lucas, Rafael ou Bruno) para ver o que já pode ser começado e o que falta você informar.

## Estrutura

```
app/             Site (React + Vite) e Netlify Functions (rodam em localhost por enquanto; o Netlify só entra no final, ver plano D8)
supabase/        Migrations SQL do banco (única fonte da verdade do schema)
printer-agent/   Agente de impressão da cozinha (Fase 4)
docs/            Documentação e runbooks
painel/          Painel local de acompanhamento do plano
```

## Como contribuir

Leia [CONTRIBUTING.md](CONTRIBUTING.md). Resumo: nada vai direto para `main`; toda mudança é uma branch + Pull Request.
