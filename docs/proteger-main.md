# Proteger a `main` no GitHub (tarefa 0.2)

Objetivo: ninguém (nem o Lucas por engano) coloca código na `main` sem passar por Pull Request, e nenhum PR entra com o CI vermelho.

O arquivo [ruleset-main.json](ruleset-main.json) guarda a configuração pronta. **Quem tem permissão de administrador do repositório** (o Rafael) importa:

1. No GitHub, abra o repositório → **Settings** → **Rules** → **Rulesets**.
2. **New ruleset** → **Import a ruleset** → escolha `docs/ruleset-main.json`.
3. Confira o resumo e clique em **Create**.

## O que a regra faz

| Regra | Efeito |
| --- | --- |
| Bloquear apagar e reescrever a `main` | Sem `git push --force` nem apagar a branch |
| Pull Request obrigatório com 1 aprovação | O Lucas precisa da aprovação do Rafael; novos commits no PR cancelam a aprovação antiga |
| Checks obrigatórios: `app`, `banco`, `plano` | O botão de mesclar só libera com os três verdes; o PR precisa estar atualizado com a `main` |
| Administrador do repositório pode mesclar PR sem aprovação (`bypass_mode: pull_request`) | O Rafael consegue mesclar os próprios PRs, mas **sempre por PR** |

Depois disso, **push direto na `main` deixa de funcionar para todos**, inclusive para o Rafael e para o Claude Code dele. O fluxo passa a ser: branch → push → PR → CI verde → mesclar pelo botão do GitHub (ou `gh pr merge`).

## Se algo der errado

- **Um check não aparece na lista**: o nome do check é o nome do job em `.github/workflows/ci.yml` (`app`, `banco`, `plano`). Eles só aparecem depois de terem rodado ao menos uma vez.
- **Precisei corrigir algo urgente e o CI está quebrado**: o administrador pode contornar pela opção de bypass do PR. Use com parcimônia e conte para o time.
- **Quer desligar**: Settings → Rules → Rulesets → *Proteger main* → **Enforcement: Disabled**.
