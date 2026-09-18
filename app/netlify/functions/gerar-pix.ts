// Netlify Function (URL: /.netlify/functions/gerar-pix). Só faz a ligação: a lógica está em
// src/server/pix/ (tipada e testada). Ver docs/pagamento.md.
import { criarDependenciasPix } from '../../src/server/pix/dependenciasPix.ts'
import { criarHandlerGerarPix } from '../../src/server/pix/pixHandlers.ts'

const handler = criarHandlerGerarPix(criarDependenciasPix(process.env))

export default (req: Request) => handler(req)
