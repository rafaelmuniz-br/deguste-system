import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatarPreco } from '../domain/dinheiro.ts'
import { formularioVazio, montarPedidoBruto, type Formulario } from '../domain/formularioPedido.ts'
import { descreverEstado } from '../domain/horario.ts'
import type { ErroPedido, PedidoCalculado } from '../domain/pedido.ts'
import { formatarTelefone } from '../domain/telefone.ts'
import { useCarrinho } from '../state/useCarrinho.ts'
import { useEstadoLoja } from '../state/useEstadoLoja.ts'
import { useLoja } from '../state/useLoja.ts'

type Etapa =
  | { tipo: 'form' }
  | { tipo: 'revisao'; pedido: PedidoCalculado }
  | { tipo: 'confirmado'; pedido: PedidoCalculado; numero: number; token?: string }

export default function Checkout() {
  const { cardapio, apiSimulada, api } = useLoja()
  const { linhas, subtotalCentavos, dispatch } = useCarrinho()
  const estado = useEstadoLoja(cardapio.loja)
  const [form, setForm] = useState<Formulario>(formularioVazio)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'form' })
  const [erros, setErros] = useState<ErroPedido[]>([])
  const [enviando, setEnviando] = useState(false)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const errosRef = useRef<HTMLDivElement>(null)

  // Leitores de tela/teclado: ao trocar de etapa, o foco vai para o título novo.
  useEffect(() => {
    tituloRef.current?.focus()
  }, [etapa.tipo])
  useEffect(() => {
    if (erros.length > 0) errosRef.current?.focus()
  }, [erros])

  const campo = (nome: keyof Formulario) => ({
    value: form[nome],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [nome]: e.target.value })),
  })
  const invalido = (prefixo: string) => erros.some((e) => e.campo?.startsWith(prefixo))

  async function verTotal(e: FormEvent) {
    e.preventDefault()
    if (!estado.aberta || enviando) return
    setEnviando(true)
    setErros([])
    const r = await api.calcular(montarPedidoBruto(form, linhas))
    setEnviando(false)
    if (r.ok) setEtapa({ tipo: 'revisao', pedido: r.pedido })
    else setErros(r.erros)
  }

  async function confirmar() {
    if (enviando) return
    setEnviando(true)
    setErros([])
    // O servidor recalcula tudo de novo; o total mostrado na revisão não é confiado.
    const r = await api.confirmar(montarPedidoBruto(form, linhas))
    setEnviando(false)
    if (r.ok) {
      dispatch({ tipo: 'limpar' })
      setEtapa({ tipo: 'confirmado', pedido: r.pedido, numero: r.numero, token: r.token })
    } else {
      setErros(r.erros)
      setEtapa({ tipo: 'form' })
    }
  }

  const listaErros = erros.length > 0 && (
    <div ref={errosRef} className="erros" role="alert" tabIndex={-1}>
      <strong>Confira antes de continuar:</strong>
      <ul>
        {erros.map((e, i) => (
          <li key={i}>{e.mensagem}</li>
        ))}
      </ul>
    </div>
  )

  // ---------------------------------------------------------------- pedido confirmado
  if (etapa.tipo === 'confirmado') {
    const { pedido, numero, token } = etapa
    return (
      <main className="pagina checkout">
        <h1 ref={tituloRef} tabIndex={-1}>
          Pedido nº {numero} registrado
        </h1>
        {apiSimulada && (
          <p className="aviso-exemplo">PEDIDO DE TESTE: nada foi enviado à cozinha nem cobrado.</p>
        )}
        <p>
          Obrigado, {pedido.cliente.nome}! Total do pedido:{' '}
          <strong>{formatarPreco(pedido.totalCentavos)}</strong>.
        </p>
        {token && (
          <>
            <Link className="btn-primario" to={`/acompanhar/${token}`}>
              Acompanhar meu pedido
            </Link>
            <p className="dica">
              Guarde o endereço da página de acompanhamento: é assim que você vê o andamento.
            </p>
          </>
        )}
        <p className="dica">
          Próximo passo: pagamento por Pix (ainda em construção). Depois do pagamento, o preparo
          leva cerca de {cardapio.loja.tempoPreparoMin} min.
        </p>
        <Link className="btn-secundario" to="/">
          Voltar ao cardápio
        </Link>
      </main>
    )
  }

  // ---------------------------------------------------------------- sacola vazia
  if (linhas.length === 0) {
    return (
      <main className="pagina checkout">
        <h1 ref={tituloRef} tabIndex={-1}>
          Finalizar pedido
        </h1>
        <p className="vazio">Sua sacola está vazia.</p>
        <Link className="btn-secundario" to="/">
          Voltar ao cardápio
        </Link>
      </main>
    )
  }

  // ---------------------------------------------------------------- revisão do total
  if (etapa.tipo === 'revisao') {
    const { pedido } = etapa
    const e = pedido.endereco
    return (
      <main className="pagina checkout">
        <h1 ref={tituloRef} tabIndex={-1}>
          Revise seu pedido
        </h1>
        {listaErros}
        <ul className="lista-sacola">
          {pedido.itens.map((item, i) => (
            <li key={i} className="linha-sacola">
              <div className="linha-info">
                <strong>
                  {item.quantidade}× {item.nome}
                </strong>
                {item.componentes.map((c, j) => (
                  <span key={j} className="linha-detalhe">
                    {c.grupoNome}: {c.opcaoNome}
                  </span>
                ))}
                {item.observacao && <span className="linha-detalhe">Obs.: {item.observacao}</span>}
                <span className="linha-preco">{formatarPreco(item.totalCentavos)}</span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="totais">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatarPreco(pedido.subtotalCentavos)}</dd>
          </div>
          <div>
            <dt>{pedido.tipo === 'entrega' ? 'Taxa de entrega' : 'Retirada no local'}</dt>
            <dd>
              {pedido.tipo === 'entrega' ? formatarPreco(pedido.taxaEntregaCentavos) : 'sem taxa'}
            </dd>
          </div>
          <div className="total">
            <dt>Total</dt>
            <dd>{formatarPreco(pedido.totalCentavos)}</dd>
          </div>
        </dl>

        <p className="dica">
          {pedido.cliente.nome} · {formatarTelefone(pedido.cliente.telefone)}
          <br />
          {e
            ? `Entrega: ${e.rua}, ${e.numero} — ${e.bairro}${e.complemento ? ` (${e.complemento})` : ''}`
            : 'Você retira no local.'}
        </p>

        <div className="rodape-acoes">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setEtapa({ tipo: 'form' })}
          >
            Voltar e editar
          </button>
          <button type="button" className="btn-primario" disabled={enviando} onClick={confirmar}>
            Confirmar pedido · {formatarPreco(pedido.totalCentavos)}
          </button>
        </div>
      </main>
    )
  }

  // ---------------------------------------------------------------- formulário
  return (
    <main className="pagina checkout">
      <p>
        <Link to="/">← Voltar ao cardápio</Link>
      </p>
      <h1 ref={tituloRef} tabIndex={-1}>
        Finalizar pedido
      </h1>

      {apiSimulada && (
        <p className="aviso-exemplo">
          Modo de exemplo: o frete é simulado (3,2 km). Use o bairro “Paripe” para ver a recusa por
          área.
        </p>
      )}
      {!estado.aberta && (
        <p className="aviso-fechado">
          {descreverEstado(estado)}. Só é possível finalizar o pedido enquanto estivermos abertos.
        </p>
      )}
      {listaErros}

      <form onSubmit={verTotal} noValidate>
        <fieldset className="grupo">
          <legend>Seus dados</legend>
          <label className="campo">
            Nome
            <input
              type="text"
              autoComplete="name"
              maxLength={80}
              aria-invalid={invalido('cliente.nome')}
              {...campo('nome')}
            />
          </label>
          <label className="campo">
            Telefone (com DDD)
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(71) 99999-9999"
              aria-invalid={invalido('cliente.telefone')}
              {...campo('telefone')}
            />
          </label>
        </fieldset>

        <fieldset className="grupo">
          <legend>Como você quer receber?</legend>
          {(['entrega', 'retirada'] as const).map((tipo) => (
            <label key={tipo} className="opcao">
              <input
                type="radio"
                name="tipo"
                value={tipo}
                checked={form.tipo === tipo}
                onChange={() => setForm((f) => ({ ...f, tipo }))}
              />
              <span className="opcao-nome">
                {tipo === 'entrega' ? 'Entrega' : 'Retirada no local'}
              </span>
            </label>
          ))}
        </fieldset>

        {form.tipo === 'entrega' && (
          <fieldset className="grupo">
            <legend>Endereço de entrega</legend>
            <label className="campo">
              Rua
              <input
                type="text"
                autoComplete="address-line1"
                maxLength={120}
                aria-invalid={invalido('endereco')}
                {...campo('rua')}
              />
            </label>
            <label className="campo">
              Número
              <input
                type="text"
                inputMode="numeric"
                maxLength={20}
                aria-invalid={invalido('endereco')}
                {...campo('numero')}
              />
            </label>
            <label className="campo">
              Bairro
              <input
                type="text"
                autoComplete="address-level3"
                maxLength={80}
                aria-invalid={invalido('endereco')}
                {...campo('bairro')}
              />
            </label>
            <label className="campo">
              Complemento (opcional)
              <input
                type="text"
                autoComplete="address-line2"
                maxLength={120}
                {...campo('complemento')}
              />
            </label>
            <label className="campo">
              Ponto de referência (opcional)
              <input type="text" maxLength={120} {...campo('referencia')} />
            </label>
          </fieldset>
        )}

        <label className="campo">
          Observações do pedido (opcional)
          <textarea rows={2} maxLength={300} {...campo('observacoes')} />
        </label>

        <section className="resumo" aria-label="Itens da sacola">
          <h2>Sua sacola</h2>
          <ul>
            {linhas.map((l) => (
              <li key={l.id}>
                {l.quantidade}× {l.produto.nome} <span>{formatarPreco(l.totalCentavos)}</span>
              </li>
            ))}
          </ul>
          <p className="total-linha">
            <span>Subtotal</span> <strong>{formatarPreco(subtotalCentavos)}</strong>
          </p>
          <p className="dica">
            {form.tipo === 'entrega'
              ? 'A taxa de entrega é calculada pelo seu endereço no próximo passo.'
              : 'Sem taxa de entrega.'}
          </p>
        </section>

        <button type="submit" className="btn-primario" disabled={enviando || !estado.aberta}>
          {enviando ? 'Calculando…' : 'Ver total'}
        </button>
      </form>
    </main>
  )
}
