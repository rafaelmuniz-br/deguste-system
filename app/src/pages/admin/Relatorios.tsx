import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiRelatorios } from '../../data/relatoriosApi.ts'
import { formatarPreco } from '../../domain/dinheiro.ts'
import {
  PERIODOS,
  percentualDaBarra,
  periodoPredefinido,
  rotuloCanal,
  rotuloDoDia,
  rotuloHora,
  rotuloTipo,
  validarPeriodo,
  type PeriodoId,
  type RelatorioVendas,
} from '../../domain/relatorios.ts'

type Escolha = PeriodoId | 'personalizado'

/** Barra horizontal proporcional (decorativa: o número também aparece em texto). */
function Barra({ percentual }: { percentual: number }) {
  return (
    <span className="barra" aria-hidden="true">
      <span className="barra-cheia" style={{ width: `${percentual}%` }} />
    </span>
  )
}

export default function Relatorios({
  api,
  agora = () => new Date(),
}: {
  api: ApiRelatorios
  /** Injetável para teste (o "hoje" muda com o relógio). */
  agora?: () => Date
}) {
  const [periodoInicial] = useState(() => periodoPredefinido('7dias', agora()))
  const [escolha, setEscolha] = useState<Escolha>('7dias')
  const [inicio, setInicio] = useState(periodoInicial.inicio)
  const [fim, setFim] = useState(periodoInicial.fim)
  const [dados, setDados] = useState<RelatorioVendas | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  // Descarta resposta atrasada de um período que a pessoa já trocou.
  const pedidoAtual = useRef(0)

  const buscar = useCallback(
    async (de: string, ate: string) => {
      const invalido = validarPeriodo(de, ate)
      if (invalido) {
        setErro(invalido)
        return
      }
      const numero = ++pedidoAtual.current
      setCarregando(true)
      setErro('')
      try {
        const r = await api.vendas(de, ate)
        if (numero === pedidoAtual.current) setDados(r)
      } catch {
        if (numero === pedidoAtual.current) {
          setErro('Não foi possível carregar o relatório. Confira a internet e tente de novo.')
        }
      } finally {
        if (numero === pedidoAtual.current) setCarregando(false)
      }
    },
    [api],
  )

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- carga inicial de dados externos; o setState só ocorre após o await
    void buscar(periodoInicial.inicio, periodoInicial.fim)
  }, [buscar, periodoInicial])

  function escolher(id: PeriodoId) {
    const p = periodoPredefinido(id, agora())
    setEscolha(id)
    setInicio(p.inicio)
    setFim(p.fim)
    void buscar(p.inicio, p.fim)
  }

  const r = dados
  const maxDia = Math.max(0, ...(r?.porDia.map((d) => d.receitaCentavos) ?? []))
  const maxHora = Math.max(0, ...(r?.porHora.map((h) => h.pedidos) ?? []))
  const maxProduto = Math.max(0, ...(r?.produtos.map((p) => p.unidades) ?? []))

  return (
    <section aria-labelledby="titulo-relatorios">
      <h2 id="titulo-relatorios">Relatórios de vendas</h2>
      <p className="dica">
        Conta só pedidos <strong>pagos e não cancelados</strong>. Datas e horários de Salvador.
      </p>

      <div role="group" aria-label="Período" className="admin-periodos">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn-secundario"
            aria-pressed={escolha === p.id}
            onClick={() => escolher(p.id)}
          >
            {p.rotulo}
          </button>
        ))}
      </div>
      <form
        className="admin-periodo-livre"
        onSubmit={(e) => {
          e.preventDefault()
          setEscolha('personalizado')
          void buscar(inicio, fim)
        }}
      >
        <label>
          De
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
        <button type="submit" className="btn-secundario" aria-pressed={escolha === 'personalizado'}>
          Ver período
        </button>
      </form>

      {erro && (
        <p role="alert" className="erros">
          {erro}
        </p>
      )}
      {carregando && <p role="status">Carregando…</p>}

      {r && !carregando && (
        <>
          <h3 className="so-leitor">
            Resumo de {rotuloDoDia(r.inicio)} a {rotuloDoDia(r.fim)}
          </h3>
          <dl className="admin-resumo">
            <div>
              <dt>Pedidos</dt>
              <dd>{r.resumo.pedidos}</dd>
            </div>
            <div>
              <dt>Faturamento</dt>
              <dd>{formatarPreco(r.resumo.receitaCentavos)}</dd>
            </div>
            <div>
              <dt>Ticket médio</dt>
              <dd>{formatarPreco(r.resumo.ticketMedioCentavos)}</dd>
            </div>
            <div>
              <dt>Cancelados</dt>
              <dd>{r.resumo.cancelados}</dd>
            </div>
          </dl>

          {r.resumo.pedidos === 0 ? (
            <p>Nenhuma venda neste período.</p>
          ) : (
            <>
              <h3>Por dia</h3>
              <table className="admin-tabela">
                <caption className="so-leitor">Vendas por dia</caption>
                <thead>
                  <tr>
                    <th scope="col">Dia</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">Faturamento</th>
                    <th scope="col">
                      <span className="so-leitor">Proporção</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.porDia.map((d) => (
                    <tr key={d.dia}>
                      <th scope="row">{rotuloDoDia(d.dia)}</th>
                      <td>{d.pedidos}</td>
                      <td>{formatarPreco(d.receitaCentavos)}</td>
                      <td>
                        <Barra percentual={percentualDaBarra(d.receitaCentavos, maxDia)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Horário de pico</h3>
              <table className="admin-tabela">
                <caption className="so-leitor">Pedidos por hora do dia</caption>
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">
                      <span className="so-leitor">Proporção</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.porHora.map((h) => (
                    <tr key={h.hora}>
                      <th scope="row">{rotuloHora(h.hora)}</th>
                      <td>{h.pedidos}</td>
                      <td>
                        <Barra percentual={percentualDaBarra(h.pedidos, maxHora)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Por canal e tipo</h3>
              <table className="admin-tabela">
                <caption className="so-leitor">Vendas por canal e por tipo de pedido</caption>
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col">Pedidos</th>
                    <th scope="col">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porCanal.map((c) => (
                    <tr key={`canal-${c.canal}`}>
                      <th scope="row">{rotuloCanal(c.canal)}</th>
                      <td>{c.pedidos}</td>
                      <td>{formatarPreco(c.receitaCentavos)}</td>
                    </tr>
                  ))}
                  {r.porTipo.map((t) => (
                    <tr key={`tipo-${t.tipo}`}>
                      <th scope="row">{rotuloTipo(t.tipo)}</th>
                      <td>{t.pedidos}</td>
                      <td>{formatarPreco(t.receitaCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Produtos mais vendidos</h3>
              <p className="dica">
                Conta o produto de verdade: o hambúrguer escolhido dentro de um combo soma com o
                mesmo hambúrguer vendido avulso. O faturamento só aparece para o que foi vendido
                avulso (o preço do combo não se divide por produto).
              </p>
              <table className="admin-tabela">
                <caption className="so-leitor">Produtos mais vendidos</caption>
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">Unidades</th>
                    <th scope="col">Em combos</th>
                    <th scope="col">Faturamento avulso</th>
                    <th scope="col">
                      <span className="so-leitor">Proporção</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.produtos.map((p) => (
                    <tr key={p.produtoId}>
                      <th scope="row">{p.nome}</th>
                      <td>{p.unidades}</td>
                      <td>{p.unidadesEmCombo}</td>
                      <td>
                        {p.receitaAvulsaCentavos > 0 ? formatarPreco(p.receitaAvulsaCentavos) : '—'}
                      </td>
                      <td>
                        <Barra percentual={percentualDaBarra(p.unidades, maxProduto)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  )
}
