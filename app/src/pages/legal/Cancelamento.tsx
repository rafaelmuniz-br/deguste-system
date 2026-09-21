import { Link } from 'react-router-dom'
import Pendente, { Revisar } from '../../components/Pendente.tsx'
import { NEGOCIO } from '../../config/negocio.ts'
import PaginaLegal from './PaginaLegal.tsx'

export default function Cancelamento() {
  return (
    <PaginaLegal titulo="Cancelamento e reembolso">
      <p>
        Nossos lanches são preparados na hora, depois que o pedido é pago. Por isso as regras de
        cancelamento dependem de <strong>em que ponto o pedido está</strong>.
      </p>

      <table>
        <thead>
          <tr>
            <th>Situação do pedido</th>
            <th>Posso cancelar?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ainda não paguei o Pix</td>
            <td>Sim. Basta não pagar: o código expira e nada é cobrado.</td>
          </tr>
          <tr>
            <td>Pago, mas a cozinha ainda não começou a preparar</td>
            <td>
              Sim, com reembolso do valor pago. Fale com a gente pelo WhatsApp o quanto antes.
            </td>
          </tr>
          <tr>
            <td>Preparo já iniciado</td>
            <td>
              Em regra, não, porque o alimento já foi feito para você. Exceções: os casos da seção
              abaixo.
            </td>
          </tr>
          <tr>
            <td>Pedido a caminho ou entregue</td>
            <td>Não há cancelamento; veja os casos de problema abaixo.</td>
          </tr>
        </tbody>
      </table>

      <h2>Quando a gente cancela ou refaz</h2>
      <ul>
        <li>
          <strong>Item indisponível ou pedido recusado por nós:</strong> reembolso integral do que
          foi pago (ou troca por outro item, se você preferir).
        </li>
        <li>
          <strong>Item errado, faltando ou com problema de qualidade:</strong> refazemos ou
          devolvemos o valor do item. Avise <Pendente valor={NEGOCIO.prazoReclamacao} />, com uma
          foto se possível.
        </li>
        <li>
          <strong>Atraso muito acima do informado:</strong> fale com a gente pelo WhatsApp;
          avaliaremos o cancelamento com reembolso caso o pedido ainda não tenha saído.
        </li>
      </ul>

      <h2>Como funciona o reembolso</h2>
      <p>
        O reembolso é feito pelo <strong>mesmo Pix</strong> do pagamento, em até{' '}
        <Pendente valor={NEGOCIO.prazoReembolso} /> depois de aprovado. A taxa de entrega é
        devolvida quando a entrega não foi realizada por motivo da loja.
      </p>

      <h2>Direito de arrependimento</h2>
      <p>
        O Código de Defesa do Consumidor prevê arrependimento em compras feitas fora do
        estabelecimento. Como se trata de alimento preparado sob demanda, que não pode ser
        devolvido, aplicamos as regras acima.{' '}
        <Revisar>
          revisão jurídica: aplicação do art. 49 do CDC a alimento preparado na hora
        </Revisar>
      </p>

      <h2>Como pedir um cancelamento ou reembolso</h2>
      <p>
        Chame a gente no WhatsApp{' '}
        <a href={NEGOCIO.whatsappLink} target="_blank" rel="noreferrer">
          {NEGOCIO.whatsapp}
        </a>{' '}
        com o <strong>número do pedido</strong> e o nome usado. Atendemos {NEGOCIO.horario}.
      </p>
      <p>
        Veja também os <Link to="/termos">Termos de Uso</Link> e as{' '}
        <Link to="/faq">perguntas frequentes</Link>.
      </p>
    </PaginaLegal>
  )
}
