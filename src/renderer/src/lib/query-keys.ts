import type { CollectionId, CollectionType, ComicId, LibraryQuery } from '@shared/types'

/**
 * Fábrica central de chaves do TanStack Query (docs/02-arquitetura.md §8),
 * uma entrada por domínio de `window.api`. Cada milestone que adicionar um
 * `useQuery`/`useMutation` real usa (e estende, se precisar) as chaves daqui
 * em vez de escrever arrays soltos, para `invalidateQueries` ficar consistente
 * em todo o app.
 */
export const queryKeys = {
  library: {
    all: () => ['library'] as const,
    home: () => ['home'] as const,
    list: (query: LibraryQuery) => ['comics', query] as const,
    detail: (id: ComicId) => ['comics', 'detail', id] as const,
    stats: () => ['library', 'stats'] as const,
  },

  collections: {
    all: () => ['collections'] as const,
    list: (type: CollectionType, sort: 'name' | 'updatedAt') =>
      ['collections', type, sort] as const,
    detail: (id: CollectionId) => ['collection', id] as const,
    membership: (comicIds: ComicId[]) => ['collections', 'membership', comicIds] as const,
    nextToRead: (sagaId: CollectionId) => ['collections', sagaId, 'nextToRead'] as const,
  },

  settings: {
    all: () => ['settings'] as const,
  },

  importJob: {
    current: () => ['importJob'] as const,
  },

  app: {
    info: () => ['app', 'info'] as const,
  },
} as const
