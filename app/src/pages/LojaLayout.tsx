import { useEffect, useMemo, useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import { carregarCardapio } from '../data/repositorio.ts'
import { criarApiHttp, criarApiSimulada } from '../data/pedidosApi.ts'
import type { Cardapio } from '../domain/tipos.ts'
import CarrinhoProvider from '../state/CarrinhoProvider.tsx'
import { ContextoLoja } from '../state/contextoLoja.ts'
import '../cardapio.css'

type Carga =
  | { status: 'carregando' }
  | { status: 'erro' }
  | { status: 'ok'; cardapio: Cardapio; ehExemplo: boolean }

const CHAVE_DEV = 'deguste:dev-loja'

/**
 * Só em desenvolvimento: `?loja=aberta` / `?loja=fechada` força o estado da loja para testar
 * as duas situações. Fica salvo na sessão para valer também ao navegar para /pedido.
 */
function useForcarLojaEmDev(): 'aberta' | 'fechada' | null {
  const [params] = useSearchParams()
  const daUrl = import.meta.env.DEV ? params.get('loja') : null
  useEffect(() => {
    if (daUrl !== 'aberta' && daUrl !== 'fechada') return
    try {
      sessionStorage.setItem(CHAVE_DEV, daUrl)
    } catch {
      // sem armazenamento: só vale nesta tela
    }
  }, [daUrl])
  if (!import.meta.env.DEV) return null
  if (daUrl === 'aberta' || daUrl === 'fechada') return daUrl
  try {
    const salvo = sessionStorage.getItem(CHAVE_DEV)
    return salvo === 'aberta' || salvo === 'fechada' ? salvo : null
  } catch {
    return null
  }
}

/** Carrega o cardápio uma vez e o compartilha (com a sacola e a API de pedidos) entre as páginas da loja. */
export default function LojaLayout() {
  const [carga, setCarga] = useState<Carga>({ status: 'carregando' })
  const forcar = useForcarLojaEmDev()

  useEffect(() => {
    let cancelado = false
    carregarCardapio()
      .then((r) => !cancelado && setCarga({ status: 'ok', ...r }))
      .catch(() => !cancelado && setCarga({ status: 'erro' }))
    return () => {
      cancelado = true
    }
  }, [])

  const valor = useMemo(() => {
    if (carga.status !== 'ok') return null
    const cardapio: Cardapio = forcar
      ? {
          ...carga.cardapio,
          loja: {
            ...carga.cardapio.loja,
            modo: forcar === 'aberta' ? 'forcar_aberta' : 'forcar_fechada',
          },
        }
      : carga.cardapio
    // A API simulada só existe em desenvolvimento (import.meta.env.DEV é false no build de produção).
    const apiSimulada =
      import.meta.env.DEV && (carga.ehExemplo || import.meta.env.VITE_USAR_API_SIMULADA === 'true')
    const api = apiSimulada ? criarApiSimulada(cardapio) : criarApiHttp()
    return { cardapio, ehExemplo: carga.ehExemplo, apiSimulada, api }
  }, [carga, forcar])

  if (carga.status === 'carregando') {
    return (
      <main className="pagina">
        <p role="status">Carregando cardápio…</p>
      </main>
    )
  }
  if (carga.status === 'erro' || !valor) {
    return (
      <main className="pagina">
        <p role="alert">Não conseguimos carregar o cardápio agora. Tente novamente em instantes.</p>
      </main>
    )
  }
  return (
    <ContextoLoja.Provider value={valor}>
      <CarrinhoProvider cardapio={valor.cardapio}>
        <Outlet />
      </CarrinhoProvider>
    </ContextoLoja.Provider>
  )
}
