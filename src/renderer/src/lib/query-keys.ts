import type { ComicId, FolderLocation, LibraryQuery } from '@shared/types'
export const queryKeys = {
  library: {
    all: () => ['library'] as const,
    home: () => ['library', 'home'] as const,
    list: (query: LibraryQuery) => ['library', 'list', query] as const,
    detail: (id: ComicId) => ['library', 'detail', id] as const,
    stats: () => ['library', 'stats'] as const,
    folder: (location: FolderLocation) => ['library', 'folder', location] as const,
  },
  settings: {
    all: () => ['settings'] as const,
  },
  reader: {
    session: (id: ComicId) => ['reader', id] as const,
  },
  libraryFolders: {
    all: () => ['libraryFolders'] as const,
  },
  app: {
    info: () => ['app', 'info'] as const,
  },
} as const
