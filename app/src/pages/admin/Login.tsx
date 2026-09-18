import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../state/useAuth.ts'

export default function Login({ titulo = 'Painel admin' }: { titulo?: string }) {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const erroRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (erro) erroRef.current?.focus()
  }, [erro])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setErro('')
    const r = await entrar(email, senha)
    setEnviando(false)
    if (!r.ok) {
      setErro(r.mensagem)
      setSenha('') // não deixa a senha errada preenchida
    }
  }

  return (
    <main className="admin-login">
      <h1>{titulo}</h1>
      <p className="dica">Acesso restrito à equipe do Deguste Burguer.</p>
      <form onSubmit={enviar}>
        <label className="campo">
          E-mail
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="campo">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {erro && (
          <p ref={erroRef} className="erros" role="alert" tabIndex={-1}>
            {erro}
          </p>
        )}
        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
