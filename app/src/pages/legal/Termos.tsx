import { Link } from 'react-router-dom'
import Pendente, { Revisar } from '../../components/Pendente.tsx'
import { NEGOCIO } from '../../config/negocio.ts'
import PaginaLegal from './PaginaLegal.tsx'

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso">
      <p>
        Ao fazer um pedido pelo site do {NEGOCIO.nome} você concorda com estes termos. Se não
        concordar, você pode pedir pelo nosso WhatsApp {NEGOCIO.whatsapp}.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O site permite conhecer o cardápio e fazer pedidos de lanches para <strong>entrega</strong>{' '}
        ou <strong>retirada</strong> no nosso endereço ({NEGOCIO.endereco}). Funcionamos{' '}
        {NEGOCIO.horario}. Fora desse horário você pode ver o cardápio, mas não finalizar pedidos.
      </p>

      <h2>2. Seus dados no pedido</h2>
      <p>
        Você é responsável por informar nome, telefone e endereço corretos. Dados errados podem
        atrasar ou impedir a entrega, sem responsabilidade da loja. O tratamento dos seus dados está
        descrito na <Link to="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>3. Preços e total do pedido</h2>
      <p>
        Os preços do cardápio estão em reais e incluem os itens escolhidos. O total do pedido soma
        os itens, os adicionais e a <strong>taxa de entrega</strong> (calculada pelo seu endereço).
        O valor final é confirmado por nosso sistema antes do pagamento, e é ele que vale, mesmo que
        a sacola no seu aparelho mostre um valor diferente. Se houver erro evidente de preço no
        site, entraremos em contato antes de seguir com o pedido.
      </p>
      <p>
        Alguns itens mostram o preço original riscado e o preço com desconto; vale o preço com
        desconto exibido no momento do pedido.
      </p>

      <h2>4. Entrega e retirada</h2>
      <ul>
        <li>
          Entregamos apenas nas áreas atendidas. Se o endereço estiver fora da área, o site avisa.
        </li>
        <li>
          O tempo informado é uma <strong>estimativa</strong> e pode variar com o movimento e o
          trânsito.
        </li>
        <li>
          Confira o endereço e esteja disponível pelo telefone informado. Se não conseguirmos
          contato nem entregar por motivo do cliente, o pedido pode ser considerado entregue.{' '}
          <Revisar>definir regra para cliente ausente</Revisar>
        </li>
      </ul>

      <h2>5. Pagamento</h2>
      <p>
        O pagamento é feito por <strong>Pix</strong>, por meio de{' '}
        <Pendente valor={NEGOCIO.gatewayPix} />. O pedido só é enviado para a cozinha depois da
        confirmação do pagamento. O código Pix tem prazo de validade; depois dele, é preciso gerar
        outro. Outras formas de pagamento: <Revisar>definir se haverá outras</Revisar>
      </p>

      <h2>6. Alergias e restrições alimentares</h2>
      <p>
        Nossa cozinha manipula ingredientes que podem conter ou ter contato com alergênicos, como
        glúten, leite, ovos e derivados. Se você tem alergia ou restrição, informe no campo de
        observações e fale com a gente pelo WhatsApp antes de pedir. Não conseguimos garantir a
        ausência total de traços.
      </p>

      <h2>7. Cancelamento e reembolso</h2>
      <p>
        As regras estão na página de <Link to="/cancelamento">Cancelamento e reembolso</Link>.
      </p>

      <h2>8. Uso correto do site</h2>
      <p>
        É proibido fazer pedidos falsos, usar dados de terceiros sem autorização, tentar burlar o
        sistema ou prejudicar o funcionamento do site. Podemos recusar ou cancelar pedidos com
        indício de fraude ou abuso.
      </p>

      <h2>9. Disponibilidade</h2>
      <p>
        Fazemos o possível para manter o site no ar, mas ele pode ficar indisponível por manutenção
        ou por problemas de internet e de provedores. Nesse caso você pode pedir pelo WhatsApp{' '}
        {NEGOCIO.whatsapp}.
      </p>

      <h2>10. Marca e conteúdo</h2>
      <p>
        O nome, a marca, as fotos e os textos do {NEGOCIO.nome} pertencem à loja. Não é permitido
        usá-los sem autorização.
      </p>

      <h2>11. Mudanças e lei aplicável</h2>
      <p>
        Podemos atualizar estes termos; a versão vigente é a publicada nesta página, com a data no
        topo. Aplica-se a lei brasileira, em especial o Código de Defesa do Consumidor, e você pode
        acionar o foro do seu domicílio. <Revisar>revisão jurídica final dos termos</Revisar>
      </p>
    </PaginaLegal>
  )
}
