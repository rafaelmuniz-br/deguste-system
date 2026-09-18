-- Estruturas reservadas para a Fase 6 (cupons e cashback). Ainda sem interface:
-- existem agora só para evitar uma migração dolorosa depois.

create type public.tipo_cupom as enum ('percentual', 'valor_fixo');
create type public.tipo_movimento_cashback as enum ('credito', 'debito', 'ajuste');

create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo = upper(codigo)),
  tipo public.tipo_cupom not null,
  valor integer not null check (valor > 0),            -- % (1-100) ou centavos
  valor_minimo_pedido_centavos integer not null default 0 check (valor_minimo_pedido_centavos >= 0),
  valido_ate timestamptz,
  usos_maximos integer check (usos_maximos > 0),
  usos_atuais integer not null default 0 check (usos_atuais >= 0),
  um_uso_por_cliente boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (tipo <> 'percentual' or valor <= 100)
);

-- Livro-razão do cashback: o saldo do cliente é a soma dos movimentos.
create table public.cashback_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  pedido_id uuid references public.pedidos (id) on delete set null,
  tipo public.tipo_movimento_cashback not null,
  valor_centavos integer not null check (valor_centavos <> 0),  -- créditos > 0, débitos < 0
  descricao text,
  created_at timestamptz not null default now()
);
create index cashback_cliente_idx on public.cashback_movimentos (cliente_id);

alter table public.pedidos
  add column cupom_id uuid references public.cupons (id) on delete set null;
