import { useEffect, useMemo, useState } from 'react'
import ProdutoCard from '../components/ProdutoCard.tsx'
import ProdutoModal from '../components/ProdutoModal.tsx'
import SacolaModal from '../components/SacolaModal.tsx'
import { carregarCardapio } from '../data/repositorio.ts'
import { combinaComBusca } from '../domain/busca.ts'
import { formatarPreco } from '../domain/dinheiro.ts'
import { descreverEstado } from '../domain/horario.ts'
import type { Cardapio as CardapioDados, Produto } from '../domain/tipos.ts'
import CarrinhoProvider from '../state/CarrinhoProvider.tsx'
import { useCarrinho } from '../state/useCarrinho.ts'
import { useEstadoLoja } from '../state/useEstadoLoja.ts'
import '../cardapio.css'

type Carga =
  | { status: 'carregando' }
  | { status: 'erro' }
  | { status: 'ok'; cardapio: CardapioDados; ehExemplo: boolean }

export default function Cardapio() {
  const [carga, setCarga] = useState<Carga>({ status: 'carregando' })

  useEffect(() => {
    let cancelado = false
    carregarCardapio()
      .then((r) => !cancelado && setCarga({ status: 'ok', ...r }))
      .catch(() => !cancelado && setCarga({ status: 'erro' }))
    return () => {
      cancelado = true
    }
  }, [])

  if (carga.status === 'carregando') {
    return (
      <main className="pagina">
        <p role="status">Carregando cardápio…</p>
      </main>
    )
  }
  if (carga.status === 'erro') {
    return (
      <main className="pagina">
        <p role="alert">Não conseguimos carregar o cardápio agora. Tente novamente em instantes.</p>
      </main>
    )
  }
  return (
    <CarrinhoProvider cardapio={carga.cardapio}>
      <Conteudo cardapio={carga.cardapio} ehExemplo={carga.ehExemplo} />
    </CarrinhoProvider>
  )
}

function Conteudo({ cardapio, ehExemplo }: { cardapio: CardapioDados; ehExemplo: boolean }) {
  const { loja } = cardapio
  const estado = useEstadoLoja(loja)
  const { quantidadeTotal, subtotalCentavos, dispatch } = useCarrinho()
  const [busca, setBusca] = useState('')
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null)
  const [sacolaAberta, setSacolaAberta] = useState(false)

  const secoes = useMemo(
    () =>
      [...cardapio.categorias]
        .sort((a, b) => a.ordem - b.ordem)
        .map((categoria) => ({
          categoria,
          produtos: cardapio.produtos.filter(
            (p) => p.categoriaId === categoria.id && combinaComBusca(busca, p.nome, p.descricao),
          ),
        }))
        .filter((s) => s.produtos.length > 0),
    [cardapio, busca],
  )

  return (
    <>
      <header className="cabecalho">
        <div className="pagina">
          <h1>{loja.nome}</h1>
          <p className={`status-loja ${estado.aberta ? 'aberta' : 'fechada'}`} role="status">
            {descreverEstado(estado)}
          </p>
          <p className="sub">Hamburgueria. Sem miséria! 🍔🤘</p>
        </div>
      </header>

      {ehExemplo && (
        <p className="aviso-exemplo">
          Dados de exemplo — o cardápio real entra quando for cadastrado no sistema.
        </p>
      )}

      <div className="barra-nav">
        <div className="pagina">
          <label className="busca">
            <span className="so-leitor">Buscar no cardápio</span>
            <input
              type="search"
              placeholder="Buscar no cardápio"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <nav aria-label="Categorias" className="categorias">
            {secoes.map(({ categoria }) => (
              <a key={categoria.id} href={`#${categoria.id}`}>
                {categoria.nome}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <main className="pagina conteudo">
        {!estado.aberta && (
          <p className="aviso-fechado">
            Você pode olhar o cardápio, mas só é possível pedir enquanto estivermos abertos.
          </p>
        )}

        {secoes.length === 0 && <p className="vazio">Nenhum item encontrado para “{busca}”.</p>}

        {secoes.map(({ categoria, produtos }) => (
          <section key={categoria.id} id={categoria.id} aria-labelledby={`t-${categoria.id}`}>
            <h2 id={`t-${categoria.id}`}>{categoria.nome}</h2>
            <ul className="lista-produtos">
              {produtos.map((p) => (
                <ProdutoCard key={p.id} produto={p} onAbrir={setProdutoAberto} />
              ))}
            </ul>
          </section>
        ))}
      </main>

      {quantidadeTotal > 0 && (
        <div className="barra-sacola">
          <button type="button" className="btn-primario" onClick={() => setSacolaAberta(true)}>
            <span>Ver sacola ({quantidadeTotal})</span>
            <span>{formatarPreco(subtotalCentavos)}</span>
          </button>
        </div>
      )}

      {produtoAberto && (
        <ProdutoModal
          produto={produtoAberto}
          lojaAberta={estado.aberta}
          onFechar={() => setProdutoAberto(null)}
          onAdicionar={(linha) => {
            dispatch({ tipo: 'adicionar', linha })
            setProdutoAberto(null)
          }}
        />
      )}

      {sacolaAberta && (
        <SacolaModal
          onFechar={() => setSacolaAberta(false)}
          lojaAberta={estado.aberta}
          pedidoMinimoCentavos={loja.pedidoMinimoCentavos}
        />
      )}
    </>
  )
}
