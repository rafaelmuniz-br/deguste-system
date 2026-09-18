/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Só em dev: 'true' usa a API de pedidos simulada mesmo com o banco configurado. */
  readonly VITE_USAR_API_SIMULADA?: string
}
