import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App.tsx'
import { CONTEUDO_LEGAL_REVISADO, NEGOCIO } from '../../config/negocio.ts'

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const PAGINAS = [
  ['/privacidade', 'Política de Privacidade'],
  ['/termos', 'Termos de Uso'],
  ['/cancelamento', 'Cancelamento e reembolso'],
  ['/faq', 'Perguntas frequentes'],
] as const

describe('páginas legais', () => {
  it.each(PAGINAS)(
    '%s abre com o título certo e link para voltar ao cardápio',
    async (rota, titulo) => {
      abrir(rota)
      expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '← Voltar ao cardápio' })).toHaveAttribute(
        'href',
        '/',
      )
    },
  )

  it.each(PAGINAS)('%s funciona sem carregar o cardápio (não depende do banco)', (rota) => {
    abrir(rota)
    // síncrono de propósito: nenhuma tela de "Carregando cardápio…" no caminho
    expect(screen.queryByText('Carregando cardápio…')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('a política de privacidade cobre o que a LGPD exige: controlador, dados, bases, direitos e cookies', () => {
    abrir('/privacidade')
    for (const trecho of [
      /Quem é o responsável pelos seus dados/,
      /Quais dados coletamos/,
      /base legal/i,
      /Com quem compartilhamos/,
      /Seus direitos/,
      /Cookies e armazenamento/,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: trecho })).toBeInTheDocument()
    }
    const conteudo = within(screen.getByRole('main'))
    expect(conteudo.getByText(new RegExp(NEGOCIO.cnpj))).toBeInTheDocument()
    expect(conteudo.getByText(/Não coletamos nem guardamos dados de cartão/)).toBeInTheDocument()
  })

  it('o link "Saiba mais" do aviso de cookies aponta para a seção de cookies', () => {
    abrir('/faq')
    const aviso = screen.getByRole('complementary', { name: /cookies/i })
    expect(within(aviso).getByRole('link', { name: 'Saiba mais' })).toHaveAttribute(
      'href',
      '/privacidade#cookies',
    )
  })

  it('perguntas frequentes abrem e fecham (elementos details nativos)', async () => {
    const user = userEvent.setup()
    abrir('/faq')
    const pergunta = screen.getByText('Qual o horário de funcionamento?')
    const detalhes = pergunta.closest('details')
    expect(detalhes).not.toHaveAttribute('open')
    await user.click(pergunta)
    expect(detalhes).toHaveAttribute('open')
  })

  it('enquanto o texto não foi revisado, mostra o aviso de rascunho e marca o que falta', () => {
    abrir('/privacidade')
    if (!CONTEUDO_LEGAL_REVISADO) {
      expect(screen.getByRole('note')).toHaveTextContent(/Rascunho em revisão/)
      expect(document.querySelectorAll('mark.pendente').length).toBeGreaterThan(1)
    }
  })

  it('TRAVA: com o conteúdo marcado como revisado, não pode sobrar nenhum "[a definir]" em nenhuma página', () => {
    if (!CONTEUDO_LEGAL_REVISADO) return // só passa a valer quando alguém virar a chave
    for (const [rota] of PAGINAS) {
      const { unmount } = abrir(rota)
      expect(document.querySelectorAll('mark.pendente')).toHaveLength(0)
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      unmount()
    }
  })
})

describe('rodapé', () => {
  it('aparece no cardápio com identificação do negócio e os quatro links legais', async () => {
    abrir('/?loja=aberta')
    const rodape = await screen.findByRole('contentinfo')
    expect(within(rodape).getByText(new RegExp(NEGOCIO.cnpj))).toBeInTheDocument()
    expect(within(rodape).getByText(new RegExp(NEGOCIO.endereco.slice(0, 20)))).toBeInTheDocument()
    for (const [rota, titulo] of [
      ['/privacidade', 'Política de Privacidade'],
      ['/termos', 'Termos de Uso'],
      ['/cancelamento', 'Cancelamento e reembolso'],
      ['/faq', 'Perguntas frequentes'],
    ]) {
      expect(within(rodape).getByRole('link', { name: titulo })).toHaveAttribute('href', rota)
    }
  })

  it('links externos abrem em nova aba sem vazar o referrer', async () => {
    abrir('/faq')
    const wpp = screen.getAllByRole('link', { name: NEGOCIO.whatsapp })
    for (const a of wpp) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('não aparece no painel admin', async () => {
    abrir('/admin')
    await screen.findByRole('heading', { name: 'Painel admin' })
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /cookies/i })).not.toBeInTheDocument()
  })
})

describe('aviso de cookies', () => {
  it('aparece na primeira visita, some ao clicar em "Entendi" e não volta depois', async () => {
    const user = userEvent.setup()
    const { unmount } = abrir('/faq')
    expect(screen.getByRole('complementary', { name: /cookies/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('complementary', { name: /cookies/i })).not.toBeInTheDocument()
    expect(localStorage.getItem('deguste:aviso-cookies:v1')).toBe('1')

    unmount() // "fecha e reabre o site"
    abrir('/faq')
    expect(screen.queryByRole('complementary', { name: /cookies/i })).not.toBeInTheDocument()
  })

  it('o site NÃO grava cookies (o texto do aviso só é verdadeiro enquanto isso valer)', async () => {
    const user = userEvent.setup()
    abrir('/?loja=aberta')
    await screen.findByRole('heading', { level: 1, name: 'Deguste Burguer' })
    await user.click(screen.getByRole('button', { name: /Água mineral/ }))
    await user.click(screen.getByRole('button', { name: /Adicionar/ }))
    expect(document.cookie).toBe('')
  })
})
