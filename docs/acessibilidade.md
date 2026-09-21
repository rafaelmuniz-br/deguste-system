# Acessibilidade (tarefa 2.8)

Meta: o site funcionar para quem usa leitor de tela, só teclado, zoom grande ou tem baixa visão (WCAG 2.1 AA). A maioria dos clientes usa celular.

## O que é verificado automaticamente (a cada PR, no CI)

| O quê | Como | Onde |
| --- | --- | --- |
| Estrutura e ARIA das telas principais: cardápio (aberto e fechado), produto, combo, sacola, checkout (formulário, erros, revisão, confirmação), acompanhamento, 4 páginas legais e login | `axe-core` (regras WCAG 2.x A/AA e boas práticas) | `app/src/test/acessibilidade.test.tsx` |
| **Contraste de cor** dos pares de cores usados, nos temas **claro e escuro** | Fórmula do WCAG lendo os tokens do CSS: texto ≥ 4,5:1; bordas de campos e anel de foco ≥ 3:1 | `app/src/test/contraste.test.ts` |
| Diálogos: foco preso, Esc fecha, foco volta ao botão de origem | Testes de comportamento | `app/src/pages/Cardapio.test.tsx` |
| Formulário: rótulos, campos inválidos marcados (`aria-invalid`), foco na mensagem de erro | Testes de comportamento | `Checkout.test.tsx`, `Admin.test.tsx` |

**Achados corrigidos na auditoria:**
- Bordas dos campos tinham 1,2 a 1,4:1 de contraste (o mínimo é 3:1): criado `--borda-campo`, usado em campos e botões.
- No cardápio, o aviso e a barra de busca ficavam fora de qualquer região de leitura: agora estão em regiões nomeadas.
- Os diálogos usavam `<header>` e `<footer>`, que viravam "banner" e "rodapé" duplicados da página: trocados por `<div>`.

**Regra:** cor nova ou tema novo entra em `contraste.test.ts`; tela nova entra em `acessibilidade.test.tsx`.

## O que só pessoas conseguem verificar (checklist manual, tarefa 2.16)

O `axe` encontra cerca de um terço dos problemas. Antes do go-live, alguém precisa testar de verdade, **no celular**:

- [ ] **Só teclado** (no computador): dá para fazer um pedido inteiro só com Tab, Shift+Tab, Enter, Espaço e Esc? O foco sempre aparece e nunca "some"?
- [ ] **Leitor de tela**: TalkBack (Android) ou VoiceOver (iPhone). Os botões têm nome que faz sentido? O total, os erros e a mudança de status do pedido são anunciados?
- [ ] **Zoom / fonte grande**: aumente a fonte do sistema ao máximo e o zoom do navegador a 200%. Nada some, sobrepõe ou exige rolar para os lados?
- [ ] **Movimento reduzido**: com "reduzir movimento" ligado no sistema, não há rolagem animada.
- [ ] **Fotos**: quando houver fotos (tarefa 2.13), todas têm texto alternativo (`alt`) que descreve o que aparece. O `alt` sugerido está em `docs/levantamento-cardapio.md`.
- [ ] **Sol forte**: veja o site ao ar livre no celular, com brilho médio. Dá para ler tudo?

Anote o que encontrar como problema no PR ou fale com o Rafael.
