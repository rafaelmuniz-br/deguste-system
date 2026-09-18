import { Link } from 'react-router-dom'
import Pendente from '../../components/Pendente.tsx'
import { NEGOCIO } from '../../config/negocio.ts'
import PaginaLegal from './PaginaLegal.tsx'

export default function Faq() {
  return (
    <PaginaLegal titulo="Perguntas frequentes" mostrarData={false}>
      <div className="faq">
        <details>
          <summary>Qual o horário de funcionamento?</summary>
          <p>
            Funcionamos {NEGOCIO.horario}. Fora desse horário você vê o cardápio, mas só consegue
            finalizar o pedido quando abrirmos.
          </p>
        </details>

        <details>
          <summary>Como faço um pedido?</summary>
          <p>
            Escolha os itens no cardápio, abra a sacola e clique em &quot;Finalizar pedido&quot;.
            Informe nome, telefone e se prefere entrega ou retirada. Você confere o total antes de
            confirmar.
          </p>
        </details>

        <details>
          <summary>Quais formas de pagamento vocês aceitam?</summary>
          <p>
            Pagamos por <strong>Pix</strong>, gerado no próprio site. Outras formas:{' '}
            <Pendente valor={null} />.
          </p>
        </details>

        <details>
          <summary>Vocês entregam no meu endereço? Quanto custa?</summary>
          <p>
            Entregamos em áreas específicas de Salvador. Ao informar o endereço, o site calcula a
            taxa de entrega e avisa se ficou fora da área. Você vê o valor total antes de pagar. Se
            não entregarmos onde você está, dá para escolher a retirada.
          </p>
        </details>

        <details>
          <summary>Onde faço a retirada?</summary>
          <p>{NEGOCIO.endereco}.</p>
        </details>

        <details>
          <summary>Quanto tempo demora?</summary>
          <p>
            O tempo estimado aparece no seu pedido. É uma estimativa e pode variar com o movimento.
            Se estiver demorando, chame a gente no WhatsApp.
          </p>
        </details>

        <details>
          <summary>Posso mudar ou cancelar meu pedido?</summary>
          <p>
            Depende do andamento. Veja as regras em{' '}
            <Link to="/cancelamento">Cancelamento e reembolso</Link> e chame a gente o quanto antes.
          </p>
        </details>

        <details>
          <summary>Tenho alergia ou restrição alimentar. E agora?</summary>
          <p>
            Informe nas observações do pedido e fale com a gente pelo WhatsApp antes de pedir. Nossa
            cozinha manipula ingredientes com glúten, leite e ovos, entre outros.
          </p>
        </details>

        <details>
          <summary>O que fazem com os meus dados?</summary>
          <p>
            Usamos só o necessário para preparar e entregar o pedido. Não guardamos dados de cartão.
            Leia a <Link to="/privacidade">Política de Privacidade</Link>; nela também explicamos
            como pedir acesso ou exclusão dos seus dados.
          </p>
        </details>

        <details>
          <summary>O site saiu do ar. Como peço?</summary>
          <p>
            Pelo WhatsApp{' '}
            <a href={NEGOCIO.whatsappLink} target="_blank" rel="noreferrer">
              {NEGOCIO.whatsapp}
            </a>{' '}
            ou pelo Instagram{' '}
            <a href={NEGOCIO.instagramLink} target="_blank" rel="noreferrer">
              {NEGOCIO.instagram}
            </a>
            .
          </p>
        </details>
      </div>
    </PaginaLegal>
  )
}
