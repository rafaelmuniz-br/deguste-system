-- Fotos dos produtos (tarefa 1.11): bucket público no Supabase Storage.
--   Leitura:  qualquer pessoa (as fotos aparecem no cardápio público).
--   Escrita:  só admin (enviar, trocar e apagar).
-- O navegador reduz a foto antes de enviar; o limite abaixo é uma segunda barreira (1 MB, só WebP/JPEG).
-- Em ambientes sem Storage (o Postgres em memória dos testes cria um "storage" mínimo), nada disto roda.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos-produtos', 'fotos-produtos', true, 1048576, array['image/webp', 'image/jpeg'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists fotos_produtos_leitura_publica on storage.objects;
  create policy fotos_produtos_leitura_publica on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'fotos-produtos');

  drop policy if exists fotos_produtos_admin_insere on storage.objects;
  create policy fotos_produtos_admin_insere on storage.objects
    for insert to authenticated
    with check (bucket_id = 'fotos-produtos' and public.is_admin());

  drop policy if exists fotos_produtos_admin_atualiza on storage.objects;
  create policy fotos_produtos_admin_atualiza on storage.objects
    for update to authenticated
    using (bucket_id = 'fotos-produtos' and public.is_admin())
    with check (bucket_id = 'fotos-produtos' and public.is_admin());

  drop policy if exists fotos_produtos_admin_apaga on storage.objects;
  create policy fotos_produtos_admin_apaga on storage.objects
    for delete to authenticated
    using (bucket_id = 'fotos-produtos' and public.is_admin());
end
$$;
