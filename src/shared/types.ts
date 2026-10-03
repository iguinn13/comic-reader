export type ComicId = string
export type ReadStatus = 'unread' | 'reading' | 'read'
export type ComicFormat = 'zip' | 'rar' | 'pdf'
export type ReaderMode = 'single' | 'double' | 'vertical'
export type FitMode = 'height' | 'width' | 'original'
export interface ReaderPrefs {
  mode: ReaderMode
  fit: FitMode
  zoom: number
  verticalWidth: number
  doubleOffset: boolean
}
export interface ComicSummary {
  id: ComicId
  title: string
  format: ComicFormat
  pageCount: number
  coverUrl: string | null
  isFavorite: boolean
  status: ReadStatus
  currentPage: number
  progress: number
  lastReadAt: number | null
  createdAt: number
}
export interface ComicDetail extends ComicSummary {
  originalFileName: string
  fileSize: number
}
export interface LibraryQuery {
  search?: string
  sort: 'title' | 'createdAt' | 'lastReadAt'
  order: 'asc' | 'desc'
  status: 'all' | ReadStatus
  favoritesOnly: boolean
  limit: number
  offset: number
}
export interface Page<T> {
  items: T[]
  total: number
}
export interface HomeData {
  continueReading: ComicSummary[]
  recentlyAdded: ComicSummary[]
}
export interface ReaderPage {
  index: number
  url: string
  width: number | null
  height: number | null
}
export type ReaderSource =
  | {
      kind: 'images'
      pages: ReaderPage[]
    }
  | {
      kind: 'pdf'
      fileUrl: string
    }
export interface ReaderSession {
  comic: ComicDetail
  source: ReaderSource
  currentPage: number
  prefs: ReaderPrefs
  hasCustomPrefs: boolean
  nextInFolder: ComicSummary | null
}
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}
export interface LibraryViewSettings {
  sort: LibraryQuery['sort']
  order: LibraryQuery['order']
  status: LibraryQuery['status']
  favoritesOnly: boolean
  mode: 'flat' | 'folders'
}
export type UiLanguage = 'pt-BR' | 'en-US'
export interface Settings {
  'reader.defaults': ReaderPrefs
  'cache.maxBytes': number
  'library.view': LibraryViewSettings
  'ui.sidebarCollapsed': boolean
  'ui.language': UiLanguage
  'window.bounds': WindowBounds | null
}
export interface LibraryFolder {
  id: string
  path: string
  addedAt: number
}
export interface LibraryScanState {
  scanning: boolean
  scanned: number
  added: number
  removed: number
}
export interface DeleteComicOptions {
  deleteFile: boolean
}
export interface FolderLocation {
  folderId: string | null
  relativePath: string
}
export interface FolderEntry {
  name: string
  folderId: string
  relativePath: string
  comicCount: number
  coverUrl: string | null
  hasDirectComics: boolean
}
export interface FolderContents {
  subfolders: FolderEntry[]
  comics: ComicSummary[]
}
