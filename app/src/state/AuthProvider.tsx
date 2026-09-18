import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase.ts'
import { ContextoAuth, type EstadoAuth, type ResultadoEntrar } from './contextoAuth.ts'

// Login do painel admin (Bruno e Lucas) com e-mail e senha do Supabase Auth.
//
// IMPORTANTE: "ser admin" aqui só decide o que a TELA mostra. Quem protege os dados de verdade é o
// RLS do banco: só quem está em `public.admins` consegue ler pedidos/clientes ou escrever no
// cardápio (supabase/migrations/*_rls.sql). Um usuário logado que não é admin não enxerga nada.

const MENSAGEM_ERRO_GENERICA = 'Não foi possível entrar agora. Tente de novo em instantes.'

function traduzirErroLogin(codigo: string | undefined): string {
  switch (codigo) {
    // Mesma mensagem para e-mail inexistente e senha errada: não revela quem tem conta.
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed':
      return 'Confirme seu e-mail (link enviado pelo Supabase) antes de entrar.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
    default:
      return MENSAGEM_ERRO_GENERICA
  }
}

export default function AuthProvider({
  children,
  cliente = supabase,
}: {
  children: ReactNode
  /** Injetável para testes; em produção é o cliente público do Supabase. */
  cliente?: SupabaseClient | null
}) {
  const [estado, setEstado] = useState<EstadoAuth>(
    cliente ? { tipo: 'carregando' } : { tipo: 'sem_banco' },
  )

  useEffect(() => {
    if (!cliente) return
    let ativo = true

    async function resolver(sessao: Session | null) {
      if (!sessao) {
        if (ativo) setEstado({ tipo: 'deslogado' })
        return
      }
      if (ativo) setEstado({ tipo: 'carregando' })
      const { data, error } = await cliente!
        .from('admins')
        .select('user_id')
        .eq('user_id', sessao.user.id)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        setEstado({
          tipo: 'erro',
          mensagem: 'Não conseguimos confirmar seu acesso. Tente de novo.',
        })
      } else if (data) {
        setEstado({ tipo: 'admin', email: sessao.user.email ?? '', userId: sessao.user.id })
      } else {
        setEstado({ tipo: 'sem_permissao', email: sessao.user.email ?? '' })
      }
    }

    // O Supabase dispara INITIAL_SESSION ao assinar (sessão já salva no navegador) e depois a cada
    // login/logout. Não fazemos outras chamadas ao Supabase dentro do callback (trava a biblioteca):
    // adiamos com setTimeout.
    const { data } = cliente.auth.onAuthStateChange((_evento, sessao) => {
      setTimeout(() => void resolver(sessao), 0)
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [cliente])

  const entrar = useCallback(
    async (email: string, senha: string): Promise<ResultadoEntrar> => {
      if (!cliente) return { ok: false, mensagem: 'O sistema está sem conexão com o banco.' }
      try {
        const { error } = await cliente.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })
        if (error) return { ok: false, mensagem: traduzirErroLogin(error.code) }
        return { ok: true }
      } catch {
        return { ok: false, mensagem: MENSAGEM_ERRO_GENERICA }
      }
    },
    [cliente],
  )

  const sair = useCallback(async () => {
    await cliente?.auth.signOut()
  }, [cliente])

  const valor = useMemo(() => ({ estado, entrar, sair }), [estado, entrar, sair])
  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}
