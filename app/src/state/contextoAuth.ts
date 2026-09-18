import { createContext } from 'react'

export type EstadoAuth =
  | { tipo: 'carregando' }
  /** O app está sem credenciais do Supabase (ex.: clone novo sem .env.local). */
  | { tipo: 'sem_banco' }
  | { tipo: 'deslogado' }
  /** Logou, mas o e-mail não está na tabela `admins`. */
  | { tipo: 'sem_permissao'; email: string }
  | { tipo: 'admin'; email: string; userId: string }
  /** Não foi possível confirmar se é admin (ex.: sem rede). */
  | { tipo: 'erro'; mensagem: string }

export type ResultadoEntrar = { ok: true } | { ok: false; mensagem: string }

export type ValorAuth = {
  estado: EstadoAuth
  entrar: (email: string, senha: string) => Promise<ResultadoEntrar>
  sair: () => Promise<void>
}

export const ContextoAuth = createContext<ValorAuth | null>(null)
