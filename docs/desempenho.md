# Desempenho (Lighthouse mobile)

Meta da tarefa 2.9: **Lighthouse mobile ≥ 90** no cardápio.

## Medição (18/09/2026, build de produção local, cardápio do `deguste-dev`, sem fotos)

| Categoria | Nota |
| --- | --- |
| Desempenho | **94–97** (varia um pouco a cada medição) |
| Acessibilidade | **100** |
| Boas práticas | **100** |
| SEO | **100** |

Tempos (simulando celular médio em 4G lento): primeira pintura e maior elemento ~2,0 s, deslocamento de layout **0**, bloqueio de thread ~100–220 ms.

## O que foi feito

- **Carregamento sob demanda** (`app/src/App.tsx`): só o cardápio vem no pacote principal. Checkout, acompanhamento, páginas legais, cozinha e admin são baixados quando a pessoa chega lá. O cliente no celular não baixa o painel admin (53 kB) nem a cozinha.
- **Bibliotecas em pacotes separados** (`app/vite.config.ts`): `react` e `supabase` viram arquivos próprios, baixados em paralelo e **mantidos em cache** entre uma publicação e outra (só o código do app muda). O pacote do app caiu de 603 kB para 30 kB.
- **Sem "pulo" de layout**: durante o carregamento a página já ocupa a tela toda, então o rodapé não desce de repente quando os produtos chegam (isso derrubava a nota para 78).
- **Fotos leves**: o admin envia duas versões, a foto (1000 px) e uma **miniatura de 320 px** (~10–20 kB) que os cartões do cardápio usam; `width`/`height` fixos, `loading="lazy"` e `decoding="async"`.
- SEO: descrição da página e `robots.txt` (bloqueia `/admin`, `/cozinha` e `/acompanhar/`).

## Como medir de novo

```bash
cd app && npm run build && npx vite preview --port 4180
npx lighthouse http://localhost:4180/ --form-factor=mobile --view
```

(No Windows o Lighthouse pode terminar com um erro `EPERM` ao apagar a pasta temporária; o relatório já foi gravado.)

## Pendente

- Medir de novo **no deploy do Netlify** e com **as fotos reais** (2.13): foto grande no topo pode ser o maior elemento da tela.
- Nas fotos já enviadas antes da miniatura existir (não há nenhuma em produção), o cartão usa a foto grande; reenviar a foto gera a miniatura.
