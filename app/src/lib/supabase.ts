import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// A chave anon é pública por design; quem protege os dados é o RLS (ver supabase/migrations).
// Segredos (service role, gateway Pix) ficam só nas Netlify Functions, nunca aqui.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
