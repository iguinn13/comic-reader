import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComicSummary } from '@shared/types'
import { useSelectionStore } from '@renderer/stores/selection-store'
import { ComicCard } from './comic-card'

vi.mock('@renderer/lib/api', () => ({
  api: {
    library: {
      setFavorite: vi.fn().mockResolvedValue(undefined),
      setReadStatus: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue({ deleted: 1 }),
    },
  },
}))

const { api } = await import('@renderer/lib/api')

function makeComic(overrides: Partial<ComicSummary> = {}): ComicSummary {
  return {
    id: 'c1',
    title: 'Batman: Ano Um #1',
    format: 'zip',
    pageCount: 48,
    coverUrl: null,
    isFavorite: false,
    status: 'unread',
    currentPage: 0,
    progress: 0,
    lastReadAt: null,
    createdAt: Date.now(),
    ...overrides,
  }
}

function renderCard(comic: ComicSummary): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ComicCard comic={comic} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useSelectionStore.getState().clear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ComicCard', () => {
  it('mostra o título como placeholder quando não há capa', () => {
    renderCard(makeComic({ coverUrl: null, title: 'Sem Capa #1' }))
    // Aparece duas vezes: no placeholder da capa e na legenda abaixo do card.
    expect(screen.getAllByText('Sem Capa #1')).toHaveLength(2)
  })

  it('mostra "Não lida" para status unread', () => {
    renderCard(makeComic({ status: 'unread' }))
    expect(screen.getByText(/Não lida/)).toBeInTheDocument()
  })

  it('mostra a página atual para status reading', () => {
    renderCard(makeComic({ status: 'reading', currentPage: 11, pageCount: 48 }))
    expect(screen.getByText(/p\. 12 de 48/)).toBeInTheDocument()
  })

  it('mostra "Lida" para status read', () => {
    renderCard(makeComic({ status: 'read' }))
    expect(screen.getByText(/Lida/)).toBeInTheDocument()
  })

  it('mostra a barra de progresso só quando em andamento', () => {
    const { rerender } = renderCard(makeComic({ status: 'unread' }))
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ComicCard
            comic={makeComic({ status: 'reading', currentPage: 23, pageCount: 48, progress: 0.5 })}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('clicar no coração alterna o favorito (RF-15)', async () => {
    renderCard(makeComic({ isFavorite: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Favoritas' }))
    await waitFor(() => expect(api.library.setFavorite).toHaveBeenCalledWith(['c1'], true))
  })

  it('clicar no checkbox seleciona o card sem navegar (RF-18)', () => {
    renderCard(makeComic())
    fireEvent.click(screen.getByRole('checkbox'))
    expect(useSelectionStore.getState().selectedIds.has('c1')).toBe(true)
  })

  it('Ctrl+clique no card alterna a seleção em vez de navegar (RF-18)', () => {
    const comic = makeComic()
    renderCard(comic)
    fireEvent.click(screen.getByRole('button', { name: comic.title }), { ctrlKey: true })
    expect(useSelectionStore.getState().selectedIds.has('c1')).toBe(true)
  })
})
