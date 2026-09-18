# Como contribuir

Guia pensado para quem está começando. Se travar em qualquer passo, pergunte antes de tentar "forçar" — quase tudo no Git tem conserto, exceto segredos que vazam.

## Como saber quais são as minhas tarefas

1. Baixe a versão mais recente: `git checkout main` e `git pull`.
2. Na raiz do projeto, rode `node painel/server.js` e abra <http://localhost:4173>.
3. Na aba **Minhas tarefas**, escolha o seu nome. Você vê:
   - as tarefas em aberto, por fase, e quais **já podem ser começadas** (`▶ pode começar`) ou estão esperando outra (`⏳ aguardando`);
   - as **informações que faltam de você** (ex.: modelo da impressora), que destravam tarefas dos outros.
4. Ao terminar uma tarefa e ela ser mesclada, marque `[x]` no `PLANO-DE-PRODUCAO.md` (no mesmo PR). O painel atualiza sozinho.
5. Todo dia útil, faça `git pull` antes de começar: o plano muda conforme o projeto avança.

## O ciclo de uma tarefa

1. Escolha uma tarefa em [PLANO-DE-PRODUCAO.md](PLANO-DE-PRODUCAO.md) (ex.: `2.1`).
2. Atualize a `main` e crie uma branch:
   ```bash
   git checkout main
   git pull
   git checkout -b feat/descricao-curta
   ```
   Prefixos: `feat/` (funcionalidade), `fix/` (correção), `docs/` (documentação).
3. Faça a mudança (com o Claude Code, se quiser). Teste no navegador e rode `npm test` e `npm run lint` dentro de `app/`.
4. Salve com commits pequenos:
   ```bash
   git add <arquivos>
   git commit -m "feat: descrição do que mudou"
   ```
5. Envie e abra o Pull Request:
   ```bash
   git push -u origin feat/descricao-curta
   ```
   No GitHub, clique em **Compare & pull request** e preencha o modelo.
6. Espere o CI ficar verde e o **deploy preview** do Netlify aparecer. Abra o preview **no celular** e teste.
7. O Rafael revisa. Se pedir ajustes, faça novos commits na mesma branch.
8. Depois do merge, marque a tarefa como `[x]` no plano.

## Regras que não têm exceção

- **Nunca** faça push direto na `main`.
- **Nunca** coloque senha, chave de API ou token no código ou em commit. Segredos vão só nas variáveis do Netlify e no seu `.env.local` (que o Git ignora). Se um segredo for parar num commit por engano, avise o Rafael na hora — a chave precisa ser trocada.
- **Nunca** aponte seu ambiente local para o banco de **produção**. Local usa sempre o Supabase de DEV.
- Preço, frete e pagamento são **sempre** calculados no servidor. O navegador só mostra o resultado.
- Mudou o banco? Crie uma migration em `supabase/migrations/` (não altere só pelo painel do Supabase).
- Um PR = uma tarefa. PR pequeno é revisado rápido.

## Usando o Claude Code

Abra o Claude Code na pasta do projeto: ele lê o `CLAUDE.md` e segue as mesmas regras. Peça sempre para ele explicar o que mudou antes de você fazer commit — você é quem responde pelo PR.
