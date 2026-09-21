# Diário de produção e relatório de pausa

Registro do que foi feito em cada sessão de trabalho, pra quem chegar depois entender o que mudou, o que foi verificado e o que falta. Entradas novas entram **no topo**, como uma seção `## AAAA-MM-DD — ...`; a sessão mais antiga (abaixo) documenta tudo que já existia até ali.

---

## 2026-09-21 — Redesign visual da interface (2.17)

Pedido do Rafael: transformação **estética** do app na linguagem de apps de delivery (referência de padrões, sem copiar marca), mantendo a paleta preto e branco da Deguste e tudo que já existe (funções, regras, telas, fluxo).

Feito só com **CSS por variáveis de cor** e ajustes pequenos de marcação: capa preta com a marca e avatar, busca e categorias em chips, cartão de produto com foto grande e "+", barra de sacola flutuante, folhas com alça, fonte Inter embutida, modo escuro, favicon da marca (era o do Vite). Sem mudança de regra de negócio; os 626 testes seguem passando, incluindo contraste WCAG nos dois temas e axe. Lighthouse mobile: 96 / 100 / 100 / 100. Documentado em `docs/design.md`.

Conferido no navegador: celular claro e escuro, desktop, folha do produto, sacola, checkout, acompanhamento com Pix, FAQ e login do admin.

Limite consciente: sem fotos reais (2.13) os cartões usam um bloco escuro da marca; o efeito completo depende delas.

---

## 2026-09-21 — Decisão do Rafael: Netlify só no final; por enquanto, localhost

**Decisão:** publicar no Netlify fica para o **final do projeto**. Até lá, tudo (site, functions e testes) roda em **localhost**, com o Supabase de dev. Não há deploy preview por PR.

**Onde ficou registrado:**
- `PLANO-DE-PRODUCAO.md`: nova decisão **D8**; D4 ajustada; **0.6 adiada** (executada só na nova **5.16**, "Publicar no Netlify", passo final antes do soft launch); nova **0.12** (rodar as functions localmente, necessária para o pedido de teste de ponta a ponta e para o Pix no sandbox); **3.2** e **3.15** passam a usar `.env` local em vez de Netlify; 5.11 depende da 5.16; definição de "pronto" e riscos sem deploy preview.
- `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` e o template de PR: teste em localhost (celular na mesma rede Wi-Fi, `http://<IP>:5173`).
- `docs/arquitetura-pedido.md` e `docs/pagamento.md`: variáveis de ambiente em `.env` local por enquanto; webhook do gateway em localhost precisa de túnel temporário ou do botão "Já paguei".

**Consequências a lembrar:**
1. O que hoje aparece como "Bloqueado: 0.6 Netlify" (relatório de 18/09 e nota do Lucas em 0.6) **deixa de ser pendência**: só volta na 5.16.
2. Sem Netlify, o site **não pode ser divulgado a clientes**: isso é intencional até o go-live.
3. A próxima tarefa técnica que destrava os testes reais é a **0.12** (functions em localhost); junto com os admins (1.7) e o sandbox do gateway (3.1/3.2).
4. Ainda vale o subdomínio gratuito do Netlify (2.10) quando chegar a 5.16; o site de produção deve apontar para o `deguste-prod`, não para o dev.

---

## 2026-09-19 — Sessão do Lucas (autônoma, mais duas pendências resolvidas)

**Confirmado:** o Realtime já está habilitado para `pedidos` e `impressoes` no `deguste-dev` (item nº 6 da lista "Bloqueado" abaixo) — checado direto em `pg_publication_tables`, resultado das próprias migrations aplicadas na tarefa 1.14. Não precisa de nenhuma ação manual no painel.

**Tarefa 2.10 — Domínio decidido.** Optei pelo subdomínio gratuito da Netlify por enquanto (consistente com a premissa de "custo fixo R$ 0" do projeto); domínio próprio (~R$ 40/ano) fica como opção futura, sem pressa. Documentado no plano (2.10 e pendência P8).

**Documentação atualizada:** `PLANO-DE-PRODUCAO.md`.

---

## 2026-09-19 — Sessão do Lucas (autônoma, continuação)

**Tarefa executada: 2.2 — Carga do cardápio real no banco `deguste-dev`.**

Criado `supabase/seed-cardapio-real.sql`: remove o cardápio de exemplo (`supabase/seed.sql`) e carrega o cardápio real completo a partir de `docs/levantamento-cardapio.md` — 5 categorias, 35 produtos (6 combos), 34 grupos de opção, 158 opções. Aplicado no `deguste-dev` via conector Supabase (testado primeiro, corrigido um erro de ordem de exclusão — `opcoes.produto_id` é `on delete restrict` — antes de aplicar).

Isso também resolveu, na prática, a tarefa **2.14** (o que fazer com "Brownie de Chocolate", que está `Inativo` mas aparecia dentro de combos no site antigo): decisão provisória de tratá-lo como resquício e deixá-lo de fora inteiramente (nem avulso, nem opção de combo), registrada no plano para o Bruno confirmar ou reverter.

**Verificação de ponta a ponta no navegador (com a loja aberta via `?loja=aberta`):**
- Cardápio completo carregando do banco real (todas as categorias, preços "de/por" e selos de desconto corretos).
- Abri o "Combo 3 Smashs 90g", cliquei 3x em "Aumentar quantidade de Jackfino": contador foi a 3, o botão "Aumentar" das outras opções do mesmo grupo ficou desabilitado (limite do grupo atingido) e o botão "Adicionar" ficou habilitado — confirma que a tarefa 2.11 (repetição de opção) funciona com dados reais, não só nos testes automatizados.

**Problema encontrado (ambiente, não código):** depois de editar `supabase/seed-cardapio-real.sql`, o Vite HMR do servidor de dev ficou com um erro fantasma (`temDesconto is not defined`, variável que não existe mais no código-fonte atual). Resolvido reiniciando o servidor e abrindo uma aba nova do navegador — confirmado por `grep` que o código-fonte não tinha mais essa variável, então era só cache do HMR.

**Documentação atualizada:** `PLANO-DE-PRODUCAO.md` (2.2 e 2.14 marcadas, nota na 2.1 sobre o Brownie de Chocolate), este diário.

**Próxima tarefa recomendada:** `git pull` antes de decidir (Rafael continua rápido em paralelo). Com 2.2 feita, o cardápio real já está "ao vivo" no dev — próximo passo natural seria conferir no celular (deploy preview, quando existir — depende de 0.6) ou seguir com tarefas menores só do Lucas (2.10 domínio, 2.13 fotos, 4.6 impressora).

---

## 2026-09-19 — Sessão do Lucas (autônoma, tarde)

**Tarefas executadas:**

1. **1.14 — Aplicar migrations pendentes no `deguste-dev`.** Exatamente o item nº 1 da lista "Bloqueado por decisão ou ação de gente" abaixo. As 8 migrations pendentes (`comentario_componentes_repeticoes`, `pedido_atomico`, `lgpd_direitos_do_titular`, `fila_de_impressao`, `salvar_configuracao_loja`, `fotos_produtos`, `relatorio_vendas`, `pagamento_pix`) foram aplicadas em ordem no banco `deguste-dev`, via conector Supabase (mesmo efeito do SQL Editor manual).
   - Verificação: `supabase/tests` depois (140 testes, todos passando) e `get_advisors` (segurança) conferido — só os avisos já esperados de funções `SECURITY DEFINER` (cada uma confere permissão internamente) e a tabela `agentes_impressao` com RLS sem política nenhuma (intencional).
   - `docs/migrations-aplicadas.md` e `PLANO-DE-PRODUCAO.md` (1.14) atualizados.

2. **3.12 — Páginas legais: 7 das 11 pendências resolvidas.** Lucas decidiu: razão social (Bruno Oliveira Pessoa), canal LGPD (WhatsApp) e encarregado (Lucas Costa Pinto Neves), prazo de reembolso (2 dias úteis), prazo de reclamação (mesmo dia da entrega), aprovação das regras de cancelamento e da regra de cliente ausente do rascunho, e forma de pagamento: Pix + **pagamento na entrega** (dinheiro/cartão direto com o entregador, sem gateway novo).
   - **Atenção para quem pegar o checkout:** falta adicionar a opção "pagar na entrega" na tela — hoje o fluxo assume só Pix.
   - Restam 4 pendências, nenhuma bloqueante: gateway Pix (3.1), serviço de mapas (3.5), prazo de retenção de dados (precisa do contador) e revisão jurídica final.
   - PR: `docs/paginas-legais-decisoes` (#35).

**Verificações realizadas:** `npm test`, `npm run typecheck`, `npm run lint`, `npx prettier --check` em `app/`; `npm test` em `supabase/`; conferência visual no navegador local.

**Problemas encontrados e resolvidos:** dois textos com palavra duplicada depois de inserir os valores decididos, corrigidos; import `Pendente` sem uso removido de `Faq.tsx`.

**Cuidado ao ler o restante deste diário:** a sessão de 18/09 abaixo é de **outra pessoa/sessão** (Rafael, "modo automático") — os números de PR e o estado "45 de 97" são daquele momento; várias linhas da tabela "O que falta" já foram resolvidas nesta entrada (item 1) ou por mim depois (ver `PLANO-DE-PRODUCAO.md` para o estado atual, sempre a fonte da verdade).

**Próxima tarefa recomendada:** `git pull` de novo antes de decidir (o Rafael trabalha muito rápido em paralelo) e conferir `node painel/server.js` (http://localhost:4173). Candidata forte: **2.2** (carregar o cardápio real no banco — agora desbloqueada: 2.1, 2.11, 2.12 e 0.7-dev todas prontas).

---

## 2026-09-18 — Sessão do Rafael (modo automático)

Registro do que foi feito na sessão de produção em modo automático (18/09/2026) e do que falta, tal como escrito naquele momento (histórico, não atualizado). O status oficial das tarefas é sempre o `PLANO-DE-PRODUCAO.md` atual.

### Onde paramos

- `main` está em dia, sem PR aberto e sem trabalho pela metade. Última entrega: exportação de pedidos em CSV (PR #33).
- Testes no fim da sessão: **app 626**, **banco 140+** (PGlite: migrations, RLS, funções, fluxos de ponta a ponta), agente de impressão 43. CI verde (jobs `app`, `banco`, `plano`, `agente`).
- Tudo foi testado com **fakes/bancos em memória**. **Nada do que foi feito nesta sessão foi ainda validado contra o Supabase real, o Netlify, o gateway de Pix ou a impressora real**: isso depende de ações humanas (abaixo).

### O que foi entregue nesta sessão (PRs #20 a #33)

| PR | Entrega | Tarefas |
| --- | --- | --- |
| #20 | Painel da cozinha (`/cozinha`): colunas, alerta sonoro, tempo real com indicador, cancelar com motivo, reimprimir, faixa de impressão com falha | 4.1, 4.2, 4.4, 4.9, 4.10 |
| #21 | Admin: categorias e produtos, esgotado com um toque | 1.8, 1.9, 4.3 |
| #22 | Admin: configurações da loja (horários, aberta/fechada, frete, tempo de preparo); função atômica no banco | 1.12 |
| #23 | Admin: opções dos produtos (monte o seu, adicionais, vínculo de combo com produto real) | 1.10 |
| #24 | Upload de fotos (reduz no navegador, bucket público, só admin grava) | 1.11 |
| #25 | Relatórios de vendas (função do banco, fuso da Bahia, combos por produto real) | 6.2 |
| #26 | Desempenho: Lighthouse mobile 94–97, sob demanda, miniaturas, SEO | 2.9 |
| #27 | Pix no banco: idempotência, trava de valor, expiração, estorno | (3.8/3.9 parciais) |
| #28 | Pix no servidor: `gerar-pix`, `webhook-pix`, `expirar-pedidos`, adaptador Mercado Pago; testes de ponta a ponta | 3.14 |
| #29 | Tela do Pix (QR desenhado no navegador, copia e cola, prazo) | (3.8 parcial) |
| #30 | Cozinha avisa pagamentos para conferir/estornar; checkout leva ao Pix | — |
| #31 | Waze e WhatsApp do entregador; previsão de preparo ao cliente | 4.5, 6.1 |
| #32 | Runbook de incidentes, plano de contingência, rotina que mantém o banco ativo | (5.4, 5.5, 5.6 parciais) |
| #33 | Exportar pedidos em CSV sem dado pessoal | (6.2 complemento) |

Documentos novos: `docs/cozinha.md`, `admin-cadastro.md`, `relatorios.md`, `desempenho.md`, `pagamento.md`, `runbook.md`, `contingencia.md`, `manter-banco-ativo.md`.

### Erros achados e corrigidos no caminho (para lembrar)

- Function `webhook-pix` sem variável de ambiente estourava exceção não tratada: agora responde 502 limpo (teste de regressão).
- Rodapé "pulando" ao carregar o cardápio derrubava o Lighthouse para 78 (CLS 0,34): corrigido (nota 94–97).
- Testes de acessibilidade ficaram frágeis com páginas carregadas sob demanda: agora pré-carregam.
- O trecho do adaptador Mercado Pago que confere a assinatura usa o mesmo id que depois processa (evita assinar um id e agir sobre outro).

### Relatório do que falta

#### A. Bloqueado por decisão ou ação de gente (o que mais destrava)

| # | O que | Quem | Por que importa |
| --- | --- | --- | --- |
| 1 | **1.14 Aplicar no `deguste-dev` as migrations 150000 a 220000** (lista em `docs/migrations-aplicadas.md`) | Lucas | Sem isso, admin, cozinha, fotos, relatórios, Pix e impressão não funcionam com banco real |
| 2 | **1.7 Criar os usuários admin** e linhas em `admins` (`docs/criar-admins.md`) | Lucas + Rafael | Sem admin, nenhuma tela restrita foi vista com o banco real |
| 3 | **3.1 Escolher o gateway** (Mercado Pago é o candidato pronto) e **3.2 conta no CNPJ + sandbox** | Rafael + Lucas | Única forma de provar o Pix de verdade; fecha 3.8, 3.9 e libera 5.1 |
| 4 | **0.6 Netlify**: site conectado + variáveis (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORS_API_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `SITE_URL`, `PIX_EMAIL_PAGADOR`) | Rafael | Sem site publicado nada é usado por clientes |
| 5 | **0.7 `deguste-prod`** (segundo projeto Supabase) | Lucas + Rafael | Necessário antes de 2.15 e do go-live |
| 6 | **Realtime** habilitado para `pedidos` e `impressoes` (a migration já pede; conferir no painel) | Lucas | Painel da cozinha em tempo real |
| 7 | **4.6 modelo da impressora** (P2) e **4.13/4.11 testes no PC da cozinha** | Lucas | Impressão real ainda não foi testada |
| 8 | **4.8** layout do recibo aprovado; **2.14** Brownie; regras de cancelamento (P12) | Bruno | Decisões de negócio |
| 9 | **3.12/3.13** revisão jurídica e canal de privacidade (P11) e virar a trava `CONTEUDO_LEGAL_REVISADO` | Lucas + apoio jurídico | Não dá para publicar o site com o texto em rascunho |
| 10 | **2.13** fotos reais; **2.16** teste manual de acessibilidade no celular; **2.10** domínio | Lucas | Qualidade e lançamento |
| 11 | Variáveis do GitHub `SUPABASE_URL` e `SUPABASE_ANON_KEY` (rotina que mantém o banco ativo) | Rafael | 5.4 |
| 12 | Preencher contatos e chave Pix no `runbook.md` e `contingencia.md`; imprimir | Lucas + Bruno | 5.5, 5.6 |
| 13 | 2FA em Supabase e GitHub (5.9); convidar Rafael como admin do Supabase; incluir o job `agente` nos checks obrigatórios do ruleset | Lucas / Rafael | Segurança |

#### B. Depende do que precisa acontecer acima, mas o código já está pronto

- **3.8 e 3.9 (Pix)**: banco, functions, adaptador, tela e testes prontos; falta o **sandbox real** (pontos `SANDBOX:` em `app/src/server/pix/mercadoPago.ts`).
- **3.15** verificação de pedido de ponta a ponta no dev; **4.7** agente na impressora real.
- **2.2 seed do cardápio real** (depende de 2.14 e das fotos/preço final) e **2.15** (produção).

#### C. Ainda não feito e dá para eu fazer quando retomar

- **6.3** histórico por cliente (telefone) e clientes recorrentes.
- **6.5 cupons** e **6.6 conta de cliente + cashback** (tabelas reservadas já existem; são maiores).
- **3.4 geolocalização** do cliente (consentimento) e **3.5/3.6 frete e área de atendimento**: código do provedor existe; falta validar com a chave real e a regra de preço (P4).
- **5.2 backup completo** com restauração testada (a exportação CSV serve de cópia parcial; backup completo precisa de decisão de onde guardar sem vazar dados; **não** usar artefatos do GitHub, o repositório é público) e **5.3 monitoramento** (alerta de function com falha/agente offline).
- **Fase 7** (iFood/99Food): começa por pesquisa de APIs (7.1).
- Melhorias citadas nos documentos: tempo de deslocamento somado à previsão (depende de 3.5), tela de pagamentos a conferir com histórico.

#### D. Riscos a ter em mente

1. Nada foi ainda rodado contra Supabase/Netlify/gateway reais: o primeiro dia de teste real vai revelar pequenos ajustes.
2. Adaptador do Mercado Pago escrito pela documentação: conferir formatos e assinatura no sandbox antes de qualquer teste com dinheiro.
3. Política de pagamento tardio (estornar, não aceitar) é decisão minha a confirmar com o Bruno (`docs/pagamento.md`).
4. Migrations são aplicadas manualmente pelo Lucas, em ordem: erro de ordem é o risco mais provável.

### Como retomar

1. `git pull` em `main`; `docs/migrations-aplicadas.md` mostra o que falta aplicar.
2. Lucas aplica as migrations 150000–220000 no dev e cria os admins (`docs/criar-admins.md`); depois abrir `/admin` e `/cozinha` no dev e fazer um pedido de teste.
3. Decidir o gateway (3.1) e criar a conta sandbox (3.2); com isso, a próxima sessão valida 3.8/3.9.
4. Rodar `node painel/server.js` e abrir <http://localhost:4173> para ver o plano por pessoa.
