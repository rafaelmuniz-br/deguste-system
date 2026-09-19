import { Link } from 'react-router-dom'
import Pendente, { Revisar } from '../../components/Pendente.tsx'
import { NEGOCIO } from '../../config/negocio.ts'
import PaginaLegal from './PaginaLegal.tsx'

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade">
      <p>
        Esta política explica quais dados pessoais o {NEGOCIO.nome} coleta quando você faz um pedido
        pelo nosso site, para que usamos, com quem compartilhamos e como você pode exercer os seus
        direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
      </p>

      <h2>1. Quem é o responsável pelos seus dados</h2>
      <p>
        O responsável (controlador) é o <strong>{NEGOCIO.nome}</strong>
        {NEGOCIO.razaoSocial ? ` (${NEGOCIO.razaoSocial})` : null}, CNPJ {NEGOCIO.cnpj}, com sede em{' '}
        {NEGOCIO.endereco}. Razão social: <Pendente valor={NEGOCIO.razaoSocial} />.
      </p>
      <p>
        Pessoa responsável pelo atendimento de assuntos de dados (encarregado):{' '}
        <Pendente valor={NEGOCIO.encarregado} />. Canal de contato:{' '}
        <Pendente valor={NEGOCIO.canalPrivacidade} />.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <p>Coletamos somente o necessário para preparar e entregar o seu pedido:</p>
      <ul>
        <li>
          <strong>Identificação e contato:</strong> nome e telefone (com DDD).
        </li>
        <li>
          <strong>Endereço de entrega</strong> (quando você escolhe entrega): rua, número, bairro,
          complemento e ponto de referência.
        </li>
        <li>
          <strong>Dados do pedido:</strong> itens, observações, valores, tipo (entrega ou retirada)
          e situação do pedido e do pagamento.
        </li>
        <li>
          <strong>Dados técnicos mínimos</strong> gerados pelo funcionamento do site e dos
          provedores que usamos (como endereço IP e registros de acesso), para segurança e
          diagnóstico.
        </li>
      </ul>
      <p>
        <strong>Não coletamos nem guardamos dados de cartão.</strong> O pagamento por Pix é
        processado por um provedor de pagamento (<Pendente valor={NEGOCIO.gatewayPix} />
        ), que recebe apenas o que é necessário para gerar a cobrança. Se você escolher pagar na
        entrega (dinheiro ou cartão), o pagamento é feito direto com o entregador, sem passar pelo
        site. Hoje o site não exige criação de conta nem senha para o cliente. Se isso mudar (por
        exemplo, com programa de cashback), esta política será atualizada antes.
      </p>

      <h2>3. Para que usamos os dados e em que base legal</h2>
      <table>
        <thead>
          <tr>
            <th>Finalidade</th>
            <th>Base legal (LGPD, art. 7º)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Receber, preparar, entregar e cobrar o seu pedido; avisar sobre a situação dele</td>
            <td>Execução de contrato (inciso V)</td>
          </tr>
          <tr>
            <td>Cumprir obrigações fiscais, contábeis e de guarda de registros</td>
            <td>Obrigação legal (inciso II)</td>
          </tr>
          <tr>
            <td>Prevenir fraude, pedidos falsos e abuso; manter a segurança do sistema</td>
            <td>Legítimo interesse (inciso IX)</td>
          </tr>
          <tr>
            <td>
              Enviar mensagens opcionais por WhatsApp (só se o recurso existir e você aceitar)
            </td>
            <td>Consentimento (inciso I), que você pode retirar quando quiser</td>
          </tr>
        </tbody>
      </table>
      <p>Não vendemos seus dados e não os usamos para publicidade de terceiros.</p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Provedores de tecnologia</strong> que hospedam o site e o banco de dados (Netlify
          e Supabase). O banco de dados fica em servidores no Brasil (região de São Paulo); a
          entrega do site pode passar por servidores fora do país.{' '}
          <Revisar>confirmar transferência internacional</Revisar>
        </li>
        <li>
          <strong>Provedor de pagamento Pix:</strong> <Pendente valor={NEGOCIO.gatewayPix} />.
        </li>
        <li>
          <strong>Serviço de mapas/rotas</strong>, que recebe o endereço de entrega para calcular a
          distância e a taxa. <Revisar>definir o serviço usado</Revisar>
        </li>
        <li>
          <strong>Entregadores</strong>, que recebem nome, telefone e endereço somente para realizar
          a entrega do seu pedido.
        </li>
        <li>
          <strong>Autoridades</strong>, quando exigido por lei ou ordem judicial.
        </li>
      </ul>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Guardamos os dados pelo tempo necessário para cumprir as finalidades acima e as obrigações
        legais (como as fiscais e contábeis). Depois disso, eliminamos ou tornamos os dados
        anônimos. <Revisar>definir prazo de retenção dos pedidos</Revisar>
      </p>

      <h2>6. Seus direitos</h2>
      <p>Você pode pedir, a qualquer momento (LGPD, art. 18):</p>
      <ul>
        <li>confirmação de que tratamos seus dados e acesso a eles;</li>
        <li>correção de dados incompletos ou desatualizados;</li>
        <li>
          anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com
          a lei;
        </li>
        <li>portabilidade dos dados;</li>
        <li>informação sobre com quem compartilhamos os seus dados;</li>
        <li>retirada do consentimento, quando essa for a base usada;</li>
        <li>oposição a um tratamento que considere irregular.</li>
      </ul>
      <p>
        Para exercer qualquer direito, fale com a gente por{' '}
        <Pendente valor={NEGOCIO.canalPrivacidade} />. Alguns dados precisam ser mantidos por
        obrigação legal mesmo depois de você pedir a eliminação; nesse caso explicaremos o motivo.
        Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão segura (HTTPS), controle de acesso restrito à equipe e proteção de acesso aos
        dados no banco. Nenhum sistema é 100% imune a falhas; se houver um incidente que possa
        afetar você, avisaremos como a lei exige.
      </p>

      <h2 id="cookies">8. Cookies e armazenamento no navegador</h2>
      <p>
        Este site guarda no seu navegador <strong>apenas o essencial para funcionar</strong>: a sua
        sacola de compras (para você não a perder se recarregar a página) e o registro de que você
        viu o aviso sobre cookies. Esses itens ficam só no seu aparelho e você pode apagá-los quando
        quiser nas configurações do navegador (a sacola, então, será esvaziada).
      </p>
      <p>
        <strong>Não usamos</strong> cookies de publicidade, de estatística ou de terceiros. Se isso
        mudar, pediremos o seu consentimento antes de gravar qualquer cookie não essencial e
        atualizaremos esta política.
      </p>

      <h2>9. Mudanças nesta política</h2>
      <p>
        Podemos atualizar esta política. A data da última atualização fica no topo da página.
        Mudanças importantes serão destacadas no site.
      </p>

      <p>
        Dúvidas sobre o pedido? Veja as <Link to="/faq">perguntas frequentes</Link> ou fale com a
        gente pelo WhatsApp {NEGOCIO.whatsapp}.
      </p>
    </PaginaLegal>
  )
}
