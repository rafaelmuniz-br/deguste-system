// Agente de impressão da cozinha.
//   npm start          liga o agente (consome a fila de pedidos pagos)
//   npm run teste      imprime UM recibo de exemplo, para conferir a impressora (não usa o banco)
import { criarApiSupabase } from './api.js'
import { criarAgente } from './agente.js'
import { errosDeCredenciais, lerConfig } from './config.js'
import { pedidoDeExemplo } from './exemplo.js'
import { montarRecibo } from './recibo.js'
import { criarTransporte } from './transportes.js'

const { config, erros } = lerConfig(process.env)
const modoTeste = process.argv.includes('--teste')

if (!modoTeste) erros.push(...errosDeCredenciais(config))
if (erros.length > 0) {
  console.error('Não deu para ligar o agente. Corrija o arquivo .env:\n')
  for (const e of erros) console.error(`  - ${e}`)
  console.error('\nModelo com todas as opções: .env.example')
  process.exit(1)
}

const transporte = criarTransporte(config.impressora)
const formatar = (job) => montarRecibo(job, config)

if (modoTeste) {
  console.log(`Imprimindo um recibo de teste em: ${transporte.nome}`)
  try {
    await transporte.enviar(formatar({ ...pedidoDeExemplo, pedido: { ...pedidoDeExemplo.pedido, criado_em: new Date().toISOString() } }))
    console.log('Enviado. Confira o papel: acentos (ç, ã, é), tamanho da letra e o corte.')
  } catch (e) {
    console.error(`Falhou: ${e.message}`)
    process.exit(1)
  }
} else {
  const api = await criarApiSupabase(config.supabase)
  const agente = criarAgente({ api, transporte, formatar, intervaloMs: config.intervaloMs })
  const desligar = () => agente.parar()
  process.on('SIGINT', desligar)
  process.on('SIGTERM', desligar)
  await agente.iniciar()
}
