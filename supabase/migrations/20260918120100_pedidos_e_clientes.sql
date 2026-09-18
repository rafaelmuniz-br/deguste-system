-- Clientes, pedidos e itens. Pedidos NASCEM channel-agnostic (D3): todo pedido tem
-- `canal` e todo item (e componente de combo) aponta para um produto real.

create type public.canal_pedido as enum ('proprio', 'ifood', '99food');
create type public.tipo_entrega as enum ('entrega', 'retirada');
create type public.status_pedido as enum (
  'aguardando_pagamento', 'novo', 'em_preparo', 'pronto', 'saiu_para_entrega', 'concluido', 'cancelado'
);
create type public.status_pagamento as enum ('pendente', 'pago', 'expirado', 'estornado', 'falhou');

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  telefone text not null unique check (telefone ~ '^[0-9]{10,13}$'),  -- só dígitos, com DDD
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,         -- número curto exibido na cozinha
  canal public.canal_pedido not null default 'proprio',
  canal_pedido_externo_id text,                       -- id do pedido no iFood/99Food
  cliente_id uuid references public.clientes (id) on delete set null,
  -- Snapshot: o pedido continua legível mesmo se o cliente mudar/for anonimizado (LGPD).
  cliente_nome text not null,
  cliente_telefone text not null,
  tipo public.tipo_entrega not null,
  status public.status_pedido not null default 'aguardando_pagamento',
  pagamento_status public.status_pagamento not null default 'pendente',
  pagamento_metodo text,                              -- 'pix', 'dinheiro', 'marketplace'...
  pagamento_externo_id text,                          -- id da cobrança no gateway
  pago_em timestamptz,
  -- Endereço de entrega (nulo em retirada).
  endereco_rua text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_complemento text,
  endereco_referencia text,
  endereco_latitude double precision,
  endereco_longitude double precision,
  distancia_km numeric(6, 2),
  -- Valores calculados SEMPRE no servidor.
  subtotal_centavos integer not null check (subtotal_centavos >= 0),
  taxa_entrega_centavos integer not null default 0 check (taxa_entrega_centavos >= 0),
  desconto_centavos integer not null default 0 check (desconto_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0),
  observacoes text,
  motivo_cancelamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_centavos = subtotal_centavos + taxa_entrega_centavos - desconto_centavos),
  check (tipo = 'retirada' or endereco_rua is not null),
  check (status <> 'cancelado' or motivo_cancelamento is not null)
);
create unique index pedidos_canal_externo_uidx
  on public.pedidos (canal, canal_pedido_externo_id) where canal_pedido_externo_id is not null;
create unique index pedidos_pagamento_externo_uidx
  on public.pedidos (pagamento_externo_id) where pagamento_externo_id is not null;
create index pedidos_status_idx on public.pedidos (status, created_at desc);
create index pedidos_created_idx on public.pedidos (created_at desc);
create index pedidos_cliente_idx on public.pedidos (cliente_id);

create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete restrict,
  nome text not null,                                  -- snapshot do nome na hora da venda
  quantidade integer not null check (quantidade > 0),
  -- Preço unitário FINAL (produto + adicionais), calculado no servidor.
  preco_unitario_centavos integer not null check (preco_unitario_centavos >= 0),
  total_centavos integer not null check (total_centavos >= 0),
  observacoes text
);
create index itens_pedido_pedido_idx on public.itens_pedido (pedido_id);
create index itens_pedido_produto_idx on public.itens_pedido (produto_id);

-- Escolhas feitas dentro de um item (ex.: qual hambúrguer o cliente escolheu no combo).
-- `produto_id` preenchido = contabiliza a venda daquele produto real nos relatórios.
create table public.itens_pedido_componentes (
  id uuid primary key default gen_random_uuid(),
  item_pedido_id uuid not null references public.itens_pedido (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete restrict,
  grupo_nome text not null,
  opcao_nome text not null,
  quantidade integer not null default 1 check (quantidade > 0),
  preco_adicional_centavos integer not null default 0 check (preco_adicional_centavos >= 0)
);
create index componentes_item_idx on public.itens_pedido_componentes (item_pedido_id);
create index componentes_produto_idx on public.itens_pedido_componentes (produto_id);

create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.set_updated_at();
create trigger pedidos_updated_at before update on public.pedidos
  for each row execute function public.set_updated_at();
