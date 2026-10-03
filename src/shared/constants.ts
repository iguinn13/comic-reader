import type { ReaderPrefs } from './types'
export const IMPORTABLE_EXTENSIONS = ['.cbz', '.cbr', '.pdf', '.zip'] as const
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
export const DEFAULT_READER_PREFS: ReaderPrefs = {
  mode: 'single',
  fit: 'height',
  zoom: 1,
  verticalWidth: 0.6,
  doubleOffset: false,
}
export const SETTINGS_DEFAULTS = {
  'reader.defaults': DEFAULT_READER_PREFS,
  'cache.maxBytes': 2 * 1024 * 1024 * 1024,
  'library.view': {
    sort: 'createdAt',
    order: 'desc',
    status: 'all',
    favoritesOnly: false,
    mode: 'folders',
  },
  'ui.sidebarCollapsed': false,
  'ui.language': 'pt-BR',
  'window.bounds': null,
} as const
export const CACHE_MIN_BYTES = 512 * 1024 * 1024
export const CACHE_MAX_BYTES = 20 * 1024 * 1024 * 1024
