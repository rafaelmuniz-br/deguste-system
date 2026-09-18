-- Cardápio, opções ("monte o seu" e combos) e configuração da loja.
-- Convenções: dinheiro em CENTAVOS (integer), nunca float. Nomes em português.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Quem é administrador (Bruno e Lucas). Populada manualmente / via service role,
-- nunca pela API pública (ver 20260918120300_rls.sql).
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  nome text not null check (length(trim(nome)) > 0),
  descricao text,
  preco_centavos integer not null check (preco_centavos >= 0),
  foto_path text,                            -- caminho no Supabase Storage
  eh_combo boolean not null default false,
  disponivel boolean not null default true,  -- false = esgotado (aparece bloqueado)
  ativo boolean not null default true,       -- false = escondido do cardápio
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index produtos_categoria_idx on public.produtos (categoria_id);

-- Grupo de escolhas de um produto: "Ponto da carne", "Adicionais",
-- "Escolha seu hambúrguer" (combo).
create table public.grupos_opcao (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  min_escolhas integer not null default 0 check (min_escolhas >= 0),
  max_escolhas integer not null default 1 check (max_escolhas >= 1),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_escolhas <= max_escolhas)
);
create index grupos_opcao_produto_idx on public.grupos_opcao (produto_id);

-- Opção dentro de um grupo. Se `produto_id` estiver preenchido, escolher a opção
-- significa vender aquele produto REAL (ex.: combo em que o cliente escolhe o
-- hambúrguer) — é isso que mantém os relatórios corretos entre combos e canais.
create table public.opcoes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_opcao (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  preco_adicional_centavos integer not null default 0 check (preco_adicional_centavos >= 0),
  produto_id uuid references public.produtos (id) on delete restrict,
  disponivel boolean not null default true,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opcoes_grupo_idx on public.opcoes (grupo_id);
create index opcoes_produto_idx on public.opcoes (produto_id);

-- Configuração da loja: uma única linha (id = 1).
create type public.modo_funcionamento as enum ('automatico', 'forcar_aberta', 'forcar_fechada');

create table public.configuracoes_loja (
  id smallint primary key default 1 check (id = 1),
  nome text not null default 'Deguste Burguer',
  fuso_horario text not null default 'America/Bahia',
  modo public.modo_funcionamento not null default 'automatico',
  -- Endereço/coordenadas de origem para cálculo de distância e frete.
  endereco text,
  latitude double precision,
  longitude double precision,
  -- Regra de frete (a regra final é decisão de negócio: pendência P4 do plano).
  frete_base_centavos integer not null default 0 check (frete_base_centavos >= 0),
  frete_por_km_centavos integer not null default 0 check (frete_por_km_centavos >= 0),
  raio_maximo_km numeric(5, 2) not null default 5 check (raio_maximo_km > 0),
  pedido_minimo_centavos integer not null default 0 check (pedido_minimo_centavos >= 0),
  tempo_preparo_min integer not null default 30 check (tempo_preparo_min > 0),
  updated_at timestamptz not null default now()
);

-- Horários de funcionamento. dia_semana: 0 = domingo ... 6 = sábado. Vários
-- intervalos por dia são permitidos.
create table public.horarios_funcionamento (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  abre time not null,
  fecha time not null,
  check (fecha > abre),
  unique (dia_semana, abre)
);

create trigger categorias_updated_at before update on public.categorias
  for each row execute function public.set_updated_at();
create trigger produtos_updated_at before update on public.produtos
  for each row execute function public.set_updated_at();
create trigger grupos_opcao_updated_at before update on public.grupos_opcao
  for each row execute function public.set_updated_at();
create trigger opcoes_updated_at before update on public.opcoes
  for each row execute function public.set_updated_at();
create trigger configuracoes_loja_updated_at before update on public.configuracoes_loja
  for each row execute function public.set_updated_at();

-- Dados iniciais exigidos para o sistema funcionar (valem em qualquer ambiente).
insert into public.configuracoes_loja (id) values (1);

-- Quarta (3) a domingo (0), 18h às 22h — ajustável pelo admin.
insert into public.horarios_funcionamento (dia_semana, abre, fecha)
select d, time '18:00', time '22:00' from unnest(array[3, 4, 5, 6, 0]) as d;
