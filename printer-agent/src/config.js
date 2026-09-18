// Lê e valida as configurações (variáveis de ambiente, normalmente do arquivo .env).
// Se faltar algo, junta TODOS os problemas numa mensagem em português (em vez de estourar um por vez).

export function lerConfig(env) {
  const erros = []
  const pega = (nome) => (env[nome] ?? '').trim()
  const obrigatoria = (nome, dica) => {
    const v = pega(nome)
    if (!v) erros.push(`${nome} não foi preenchida${dica ? ` (${dica})` : ''}.`)
    return v
  }

  const tipo = pega('IMPRESSORA_TIPO') || 'arquivo'
  const impressora = { tipo }
  if (tipo === 'rede') {
    impressora.host = obrigatoria('IMPRESSORA_HOST', 'endereço IP da impressora')
    impressora.porta = Number(pega('IMPRESSORA_PORTA') || 9100)
    if (!Number.isInteger(impressora.porta) || impressora.porta < 1) erros.push('IMPRESSORA_PORTA inválida.')
  } else if (tipo === 'windows') {
    impressora.nome = obrigatoria('IMPRESSORA_NOME', 'nome de compartilhamento da impressora, sem espaços')
  } else if (tipo === 'arquivo') {
    impressora.arquivo = pega('IMPRESSORA_ARQUIVO') || 'recibos-teste.bin'
  } else {
    erros.push(`IMPRESSORA_TIPO "${tipo}" desconhecido. Use arquivo, rede ou windows.`)
  }

  const largura = Number(pega('IMPRESSORA_LARGURA') || 48)
  if (![32, 42, 48].includes(largura)) erros.push('IMPRESSORA_LARGURA deve ser 32 (papel de 58 mm) ou 48 (papel de 80 mm).')

  const acentos = pega('IMPRESSORA_ACENTOS') || 'cp860'
  if (!['cp860', 'ascii'].includes(acentos)) erros.push('IMPRESSORA_ACENTOS deve ser cp860 ou ascii.')

  const paginaDeCodigo = Number(pega('IMPRESSORA_PAGINA_CODIGO') || 3)
  const intervaloMs = Number(pega('INTERVALO_MS') || 3000)
  if (!Number.isInteger(intervaloMs) || intervaloMs < 500) erros.push('INTERVALO_MS deve ser um número de pelo menos 500.')

  const config = { impressora, largura, acentos, paginaDeCodigo, intervaloMs }

  // Credenciais do banco: só são exigidas para rodar de verdade (o teste de impressão não precisa).
  config.supabase = {
    url: pega('SUPABASE_URL'),
    anonKey: pega('SUPABASE_ANON_KEY'),
    email: pega('AGENTE_EMAIL'),
    senha: pega('AGENTE_SENHA'),
  }

  return { config, erros }
}

/** Confere as credenciais do banco (necessárias só para o modo normal). */
export function errosDeCredenciais({ supabase }) {
  const faltando = []
  if (!supabase.url) faltando.push('SUPABASE_URL')
  if (!supabase.anonKey) faltando.push('SUPABASE_ANON_KEY')
  if (!supabase.email) faltando.push('AGENTE_EMAIL')
  if (!supabase.senha) faltando.push('AGENTE_SENHA')
  return faltando.map((n) => `${n} não foi preenchida.`)
}
