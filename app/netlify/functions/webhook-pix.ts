// Netlify Function (URL: /.netlify/functions/webhook-pix): recebe o aviso de pagamento do gateway.
// Só faz a ligação: a lógica está em src/server/pix/ (assinatura, consulta ao gateway, banco idempotente).
import { criarDependenciasPix } from '../../src/server/pix/dependenciasPix.ts'
import { criarHandlerWebhookPix } from '../../src/server/pix/pixHandlers.ts'

const handler = criarHandlerWebhookPix(criarDependenciasPix(process.env))

export default (req: Request) => handler(req)
