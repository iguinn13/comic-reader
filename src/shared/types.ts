/**
 * DTOs e tipos de domínio compartilhados por main, preload e renderer.
 * Espelha docs/04-contratos-ipc.md §2 e docs/03-modelo-de-dados.md §2.
 */

export type ComicId = string
export type ReadStatus = 'unread' | 'reading' | 'read'
export type ComicFormat = 'zip' | 'rar' | 'pdf'

export type ReaderMode = 'single' | 'double' | 'vertical'
export type FitMode = 'height' | 'width' | 'original'

/** docs/03-modelo-de-dados.md §2.3. */
export interface ReaderPrefs {
  mode: ReaderMode
  fit: FitMode
  /** Multiplicador de zoom (0.25–4.0) sobre o `fit`, usado em single/double. */
  zoom: number
  /** Fração da área de leitura (0.2–1.0) ocupada pela coluna, usada no modo vertical. */
  verticalWidth: number
  /** "Deslocar pares" no modo página dupla. */
  doubleOffset: boolean
}

export interface ComicSummary {
  id: ComicId
  title: string
  format: ComicFormat
  pageCount: number
  /** null = capa ainda não gerada (placeholder no card). */
  coverUrl: string | null
  isFavorite: boolean
  status: ReadStatus
  currentPage: number
  /** 0..1 = (currentPage+1)/pageCount, 1 se lida. */
  progress: number
  lastReadAt: number | null
  createdAt: number
}

export interface ComicDetail extends ComicSummary {
  originalFileName: string
  fileSize: number
}

export interface LibraryQuery {
  /** Até 100 caracteres; comparado sem acento/caixa (docs/03 §1). */
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
  /** RF-11: HQs em andamento, mais recentes primeiro, no máx. 20. */
  continueReading: ComicSummary[]
  /** RF-63: últimas 20 HQs adicionadas. */
  recentlyAdded: ComicSummary[]
}

export interface ReaderPage {
  index: number
  /** comic://page/{id}/{index} */
  url: string
  width: number | null
  height: number | null
}

export type ReaderSource =
  { kind: 'images'; pages: ReaderPage[] } | { kind: 'pdf'; fileUrl: string }

export interface ReaderSession {
  comic: ComicDetail
  source: ReaderSource
  currentPage: number
  /** Preferências da HQ mescladas com os padrões globais. */
  prefs: ReaderPrefs
  hasCustomPrefs: boolean
  /** Próximo arquivo (ordem natural) na mesma pasta, ou null se for o último/único. */
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
  /** RF-64: "pastas" navega pela estrutura de pastas, "flat" é a lista única com filtros. */
  mode: 'flat' | 'folders'
}

/** docs/03-modelo-de-dados.md §2.6. */
export interface Settings {
  'reader.defaults': ReaderPrefs
  'cache.maxBytes': number
  'library.view': LibraryViewSettings
  'ui.sidebarCollapsed': boolean
  'window.bounds': WindowBounds | null
}

/** Uma pasta-raiz configurada pelo usuário, escaneada recursivamente (docs/05). */
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
  /** Também apaga o arquivo original do disco (com checagem de segurança no main). */
  deleteFile: boolean
}

/**
 * Onde a navegação por pastas está: `folderId: null` é o nível-topo (lista
 * as pastas-raiz configuradas); com um `folderId`, `relativePath` é o
 * caminho dentro dela ("" = raiz da própria pasta-raiz), em segmentos por
 * nome de pasta — nunca o caminho absoluto de disco (RF-64).
 */
export interface FolderLocation {
  folderId: string | null
  relativePath: string
}

/** Uma subpasta listada em `library.browseFolder` (RF-64). */
export interface FolderEntry {
  name: string
  folderId: string
  relativePath: string
  /** Quantidade de HQs dentro dela (recursivo). */
  comicCount: number
  /** Capa da 1ª HQ (ordem natural) que está direto na pasta; `null` se a pasta só tem subpastas. */
  coverUrl: string | null
  /** Tem HQs direto nela; só pastas sem HQs aceitam imagem de capa personalizada. */
  hasDirectComics: boolean
}

export interface FolderContents {
  subfolders: FolderEntry[]
  /** No nível-topo: só as HQs soltas de pastas-raiz que têm subpastas (a pasta-raiz some, ver ADR-018). */
  comics: ComicSummary[]
}
