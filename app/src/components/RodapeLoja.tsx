import { Link } from 'react-router-dom'
import { NEGOCIO } from '../config/negocio.ts'

/** Rodapé das páginas do cliente: identificação do negócio e links das páginas legais. */
export default function RodapeLoja() {
  return (
    <footer className="rodape-loja">
      <div className="pagina">
        <nav aria-label="Informações legais">
          <ul>
            <li>
              <Link to="/privacidade">Política de Privacidade</Link>
            </li>
            <li>
              <Link to="/termos">Termos de Uso</Link>
            </li>
            <li>
              <Link to="/cancelamento">Cancelamento e reembolso</Link>
            </li>
            <li>
              <Link to="/faq">Perguntas frequentes</Link>
            </li>
          </ul>
        </nav>
        <p>
          <strong>{NEGOCIO.nome}</strong> · CNPJ {NEGOCIO.cnpj}
          <br />
          {NEGOCIO.endereco}
          <br />
          WhatsApp:{' '}
          <a href={NEGOCIO.whatsappLink} target="_blank" rel="noreferrer">
            {NEGOCIO.whatsapp}
          </a>{' '}
          ·{' '}
          <a href={NEGOCIO.instagramLink} target="_blank" rel="noreferrer">
            {NEGOCIO.instagram}
          </a>
        </p>
      </div>
    </footer>
  )
}
