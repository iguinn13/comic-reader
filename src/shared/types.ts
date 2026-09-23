/**
 * DTOs e tipos de domínio compartilhados por main, preload e renderer.
 * Espelha docs/04-contratos-ipc.md §2 e docs/03-modelo-de-dados.md §2.
 */
import type { AppErrorCode } from './errors'

export type ComicId = string
export type CollectionId = string
export type ReadStatus = 'unread' | 'reading' | 'read'
export type CollectionType = 'list' | 'saga'
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

export interface ComicCollectionRef {
  id: CollectionId
  type: CollectionType
  name: string
}

export interface ComicDetail extends ComicSummary {
  originalFileName: string
  fileSize: number
  collections: ComicCollectionRef[]
}

export interface CollectionSummary {
  id: CollectionId
  type: CollectionType
  name: string
  description: string | null
  coverUrl: string | null
  coverMode: 'auto' | 'image' | 'comic'
  itemCount: number
  /** Só relevante para sagas: quantos itens já estão lidos. */
  readCount: number
  updatedAt: number
}

export interface CollectionItemRef extends ComicSummary {
  position: number
}

export interface CollectionDetail extends CollectionSummary {
  coverComicId: ComicId | null
  /** Ordenados por `position`. */
  items: CollectionItemRef[]
}

export interface LibraryQuery {
  /** Até 100 caracteres; comparado sem acento/caixa (docs/03 §1). */
  search?: string
  sort: 'title' | 'createdAt' | 'lastReadAt'
  order: 'asc' | 'desc'
  status: 'all' | ReadStatus
  favoritesOnly: boolean
  /** Filtra dentro de uma lista (RF-24). */
  collectionId?: CollectionId
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
  /** RF-63: sagas com pelo menos 1 lida e 1 não lida, no máx. 10. */
  sagasInProgress: CollectionSummary[]
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

export interface SagaContext {
  sagaId: CollectionId
  sagaName: string
  position: number
  total: number
  next: ComicSummary | null
}

export interface ReaderSession {
  comic: ComicDetail
  source: ReaderSource
  currentPage: number
  /** Preferências da HQ mescladas com os padrões globais. */
  prefs: ReaderPrefs
  hasCustomPrefs: boolean
  sagaContext: SagaContext[]
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
}

/** docs/03-modelo-de-dados.md §2.6. */
export interface Settings {
  'reader.defaults': ReaderPrefs
  'reader.focusMode': boolean
  'cache.maxBytes': number
  'library.view': LibraryViewSettings
  'ui.sidebarCollapsed': boolean
  'window.bounds': WindowBounds | null
  'import.duplicatePolicy': 'ask'
}

export type ImportItemStatus =
  | 'queued'
  | 'processing'
  | 'awaiting-duplicate-decision'
  | 'done'
  | 'skipped-duplicate'
  | 'failed'
  | 'cancelled'

export interface ImportItem {
  id: string
  /** Nome exibido; para itens de dentro de um ZIP, "pack.zip › Batman 01.cbz". */
  sourceName: string
  status: ImportItemStatus
  errorCode?: AppErrorCode
  comicId?: ComicId
  duplicateOf?: { id: ComicId; title: string }
}

export interface ImportJobState {
  jobId: string
  status: 'running' | 'paused-for-decision' | 'finished' | 'cancelled'
  items: ImportItem[]
  counts: { total: number; done: number; skipped: number; failed: number }
  startedAt: number
  finishedAt: number | null
}

export type CollectionCoverInput =
  { mode: 'auto' } | { mode: 'comic'; comicId: ComicId } | { mode: 'image'; path: string }
