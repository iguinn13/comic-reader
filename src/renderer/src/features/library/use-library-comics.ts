import { useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import type { ComicSummary, LibraryQuery } from '@shared/types'
import { sortOptionToQuery, type LibrarySortOption } from './library-sort'

const PAGE_SIZE = 60
/** Debounce da busca (RF-10): evita uma consulta a cada tecla. */
const SEARCH_DEBOUNCE_MS = 250

export interface UseLibraryComicsOptions {
  /** Favoritas (docs/07 §4.2) força `favoritesOnly` e some com os filtros de status/favoritas na toolbar. */
  forceFavoritesOnly?: boolean
  /** "Ver tudo" da Início (docs/07 §4.1): entra na Biblioteca já com um filtro/ordenação aplicados. */
  initialStatus?: LibraryQuery['status']
  initialSortOption?: LibrarySortOption
}

export interface UseLibraryComicsResult {
  items: ComicSummary[]
  total: number
  search: string
  setSearch: (value: string) => void
  status: LibraryQuery['status']
  setStatus: (value: LibraryQuery['status']) => void
  favoritesOnly: boolean
  setFavoritesOnly: (value: boolean) => void
  sortOption: LibrarySortOption
  setSortOption: (value: LibrarySortOption) => void
  isLoading: boolean
  fetchNextPage: () => void
}

/**
 * Estado + dados da grade de HQs (RF-10, 12, 13), compartilhado por
 * Biblioteca e Favoritas. Pagina via `useInfiniteQuery` em vez de carregar
 * tudo de uma vez, para não estourar RNF-02/04 com bibliotecas grandes.
 */
export function useLibraryComics(options: UseLibraryComicsOptions = {}): UseLibraryComicsResult {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<LibraryQuery['status']>(options.initialStatus ?? 'all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortOption, setSortOption] = useState<LibrarySortOption>(
    options.initialSortOption ?? 'createdAt',
  )
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handleSearchChange(value: string): void {
    setSearchInput(value)
    clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), SEARCH_DEBOUNCE_MS)
  }

  const effectiveFavoritesOnly = options.forceFavoritesOnly ?? favoritesOnly

  const baseQuery = useMemo<LibraryQuery>(
    () => ({
      search: debouncedSearch || undefined,
      status,
      favoritesOnly: effectiveFavoritesOnly,
      ...sortOptionToQuery(sortOption),
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [debouncedSearch, status, effectiveFavoritesOnly, sortOption],
  )

  const query = useInfiniteQuery({
    queryKey: queryKeys.library.list(baseQuery),
    queryFn: ({ pageParam }) => api.library.list({ ...baseQuery, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
  })

  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  return {
    items,
    total,
    search: searchInput,
    setSearch: handleSearchChange,
    status,
    setStatus,
    favoritesOnly,
    setFavoritesOnly,
    sortOption,
    setSortOption,
    isLoading: query.isLoading,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
  }
}
