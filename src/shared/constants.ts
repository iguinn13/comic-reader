import type { ReaderPrefs } from './types'

/** Extensões de arquivo aceitas na importação (RF-01, RF-03). */
export const IMPORTABLE_EXTENSIONS = ['.cbz', '.cbr', '.pdf', '.zip'] as const

/** Extensões de imagem reconhecidas como página dentro de um arquivo (docs/05 §5). */
export const IMAGE_PAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
] as const

export const TITLE_MAX_LENGTH = 200
export const COLLECTION_NAME_MAX_LENGTH = 100
export const COLLECTION_DESCRIPTION_MAX_LENGTH = 500

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  mode: 'single',
  fit: 'height',
  zoom: 1,
  verticalWidth: 0.6,
  doubleOffset: false,
}

/** Chaves e defaults de `settings` (docs/03-modelo-de-dados.md §2.6). */
export const SETTINGS_DEFAULTS = {
  'reader.defaults': DEFAULT_READER_PREFS,
  'reader.focusMode': false,
  'cache.maxBytes': 2 * 1024 * 1024 * 1024, // 2 GB
  'library.view': {
    sort: 'createdAt',
    order: 'desc',
    status: 'all',
    favoritesOnly: false,
  },
  'ui.sidebarCollapsed': false,
  'window.bounds': null,
  'import.duplicatePolicy': 'ask',
} as const

export const CACHE_MIN_BYTES = 512 * 1024 * 1024 // 512 MB
export const CACHE_MAX_BYTES = 20 * 1024 * 1024 * 1024 // 20 GB
