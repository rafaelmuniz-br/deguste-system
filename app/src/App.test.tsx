import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('mostra o cardápio na rota raiz', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Deguste Burguer' }),
    ).toBeInTheDocument()
  })

  it('mostra o painel da cozinha em /cozinha', () => {
    render(
      <MemoryRouter initialEntries={['/cozinha']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Cozinha' })).toBeInTheDocument()
  })
})
