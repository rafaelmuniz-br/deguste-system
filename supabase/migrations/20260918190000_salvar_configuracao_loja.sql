-- Configurações da loja no painel admin (tarefa 1.12).
-- Grava a configuração E os horários de funcionamento numa única transação: se qualquer parte for
-- inválida (ex.: fecha antes de abrir), NADA muda — a loja nunca fica sem horário por um erro de digitação.
--
-- `security invoker`: roda com as permissões de quem chamou, então o RLS continua valendo; a
-- checagem de admin abaixo só dá uma mensagem clara em vez de "0 linhas alteradas".

create or replace function public.salvar_configuracao_loja(p_config jsonb, p_horarios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  update public.configuracoes_loja set
    nome = trim(p_config->>'nome'),
    modo = (p_config->>'modo')::public.modo_funcionamento,
    endereco = nullif(trim(p_config->>'endereco'), ''),
    latitude = (p_config->>'latitude')::double precision,
    longitude = (p_config->>'longitude')::double precision,
    frete_base_centavos = (p_config->>'frete_base_centavos')::integer,
    frete_por_km_centavos = (p_config->>'frete_por_km_centavos')::integer,
    raio_maximo_km = (p_config->>'raio_maximo_km')::numeric,
    pedido_minimo_centavos = (p_config->>'pedido_minimo_centavos')::integer,
    tempo_preparo_min = (p_config->>'tempo_preparo_min')::integer
  where id = 1;

  delete from public.horarios_funcionamento where true;
  insert into public.horarios_funcionamento (dia_semana, abre, fecha)
  select (h->>'dia_semana')::smallint, (h->>'abre')::time, (h->>'fecha')::time
  from jsonb_array_elements(p_horarios) as h;
end;
$$;

revoke all on function public.salvar_configuracao_loja(jsonb, jsonb) from public, anon;
grant execute on function public.salvar_configuracao_loja(jsonb, jsonb) to authenticated;
