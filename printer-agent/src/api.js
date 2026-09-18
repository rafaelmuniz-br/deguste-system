// Fala com o banco pela conta PRÓPRIA do agente (não usa service_role). Só chama 3 funções:
// proxima_impressao, confirmar_impressao e registrar_falha_impressao. Ver docs/impressao.md.

export async function criarApiSupabase({ url, anonKey, email, senha }) {
  const { createClient } = await import('@supabase/supabase-js') // só carrega quando realmente vai usar
  const cliente = createClient(url, anonKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  })

  async function garantirLogin() {
    const { data } = await cliente.auth.getSession()
    if (data.session) return
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha })
    if (error) throw new Error(`login do agente falhou: ${error.message}`)
  }

  async function chamar(funcao, argumentos) {
    await garantirLogin()
    const { data, error } = await cliente.rpc(funcao, argumentos)
    if (error) throw new Error(error.message)
    return data
  }

  return {
    proxima: () => chamar('proxima_impressao'),
    confirmar: (id) => chamar('confirmar_impressao', { p_id: id }),
    falha: (id, erro) => chamar('registrar_falha_impressao', { p_id: id, p_erro: erro }),
  }
}
