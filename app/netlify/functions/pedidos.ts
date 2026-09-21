// Ponto de entrada da Netlify Function (URL: /.netlify/functions/pedidos). Só faz a ligação: toda a
// lógica está em src/server/ (tipada e testada). Ver docs/arquitetura-pedido.md.
import { criarDependenciasReais } from '../../src/server/dependenciasReais.ts'
import { criarHandler } from '../../src/server/pedidosHandler.ts'

const handler = criarHandler(criarDependenciasReais(process.env))

export default (req: Request) => handler(req)
