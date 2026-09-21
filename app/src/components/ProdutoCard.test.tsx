import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Produto } from '../domain/tipos.ts'
import ProdutoCard from './ProdutoCard.tsx'

const produto = (extra: Partial<Produto> = {}): Produto => ({
  id: 'p1',
  categoriaId: 'c1',
  nome: 'Jackfino',
  precoCentavos: 2199,
  ehCombo: false,
  disponivel: true,
  grupos: [],
  ...extra,
})

const abrir = (p: Produto) =>
  render(
    <ul>
      <ProdutoCard produto={p} onAbrir={vi.fn()} />
    </ul>,
  )

describe('ProdutoCard: foto', () => {
  it('usa a miniatura leve, com o nome do produto como texto alternativo e tamanho fixo (sem pulo de layout)', () => {
    abrir(
      produto({
        fotoUrl: 'https://cdn/p1/1.webp',
        fotoMiniaturaUrl: 'https://cdn/p1/1-mini.webp',
      }),
    )
    const img = screen.getByRole('img', { name: 'Jackfino' })
    expect(img).toHaveAttribute('src', 'https://cdn/p1/1-mini.webp')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width', '84')
    expect(img).toHaveAttribute('height', '84')
  })

  it('sem miniatura, usa a foto normal', () => {
    abrir(produto({ fotoUrl: 'https://cdn/p1/1.webp' }))
    expect(screen.getByRole('img', { name: 'Jackfino' })).toHaveAttribute(
      'src',
      'https://cdn/p1/1.webp',
    )
  })

  it('sem foto, mostra o marcador decorativo (sem texto alternativo enganoso)', () => {
    abrir(produto())
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
