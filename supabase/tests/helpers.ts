import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')

export const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
export const CLIENTE_LOGADO_ID = '22222222-2222-4222-8222-222222222222'

/**
 * Sobe um Postgres em memória (PGlite), imita o mínimo do Supabase (roles anon/authenticated,
 * schema auth, auth.uid(), privilégios padrão), aplica TODAS as migrations e o seed.
 */
export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite()

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public to service_role;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    -- O Supabase concede tudo por padrão nas tabelas novas; quem protege é o RLS + revokes.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    -- O Supabase também concede EXECUTE em funções novas; funções sensíveis revogam isso na própria migration.
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    insert into auth.users (id) values ('${ADMIN_ID}'), ('${CLIENTE_LOGADO_ID}');
  `)

  const pasta = join(raiz, 'migrations')
  for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(pasta, arquivo), 'utf8'))
  }
  await db.exec(readFileSync(join(raiz, 'seed.sql'), 'utf8'))
  await db.exec(`insert into public.admins (user_id) values ('${ADMIN_ID}')`)
  return db
}

export type Papel = { role: 'anon' } | { role: 'service_role' } | { role: 'authenticated'; userId: string }

/** Executa `fn` como se fosse uma requisição da API com o papel dado (RLS aplicado). */
export async function como<T>(db: PGlite, papel: Papel, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${papel.role}`)
  if (papel.role === 'authenticated') {
    await db.exec(`select set_config('request.jwt.claim.sub', '${papel.userId}', false)`)
  }
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`)
  }
}

export const anon: Papel = { role: 'anon' }
export const servico: Papel = { role: 'service_role' }
export const admin: Papel = { role: 'authenticated', userId: ADMIN_ID }
export const clienteLogado: Papel = { role: 'authenticated', userId: CLIENTE_LOGADO_ID }
