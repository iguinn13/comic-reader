import type { Result } from './errors'
import type {
  CollectionCoverInput,
  CollectionDetail,
  CollectionId,
  CollectionSummary,
  CollectionType,
  ComicDetail,
  ComicId,
  ComicSummary,
  HomeData,
  ImportJobState,
  LibraryQuery,
  Page,
  ReaderPrefs,
  ReaderSession,
  Settings,
} from './types'

/**
 * O contrato completo de `window.api`, implementado pelo preload
 * (src/preload/index.ts) chamando `ipcRenderer.invoke` nos canais de
 * `channels.ts`, e consumido pelo renderer via `lib/api.ts`
 * (docs/04-contratos-ipc.md §4).
 *
 * Cada método devolve `Promise<Result<T>>`: o wrapper do renderer desembrulha
 * o envelope e lança `AppError` em caso de falha, para o TanStack Query
 * tratar como uma rejeição normal.
 */
export interface ComicReaderApi {
  library: {
    home(): Promise<Result<HomeData>>
    list(query: LibraryQuery): Promise<Result<Page<ComicSummary>>>
    get(id: ComicId): Promise<Result<ComicDetail>>
    rename(id: ComicId, title: string): Promise<Result<ComicSummary>>
    setFavorite(ids: ComicId[], value: boolean): Promise<Result<void>>
    setReadStatus(ids: ComicId[], status: 'read' | 'unread'): Promise<Result<void>>
    removeFromContinue(id: ComicId): Promise<Result<void>>
    delete(ids: ComicId[]): Promise<Result<{ deleted: number }>>
    stats(): Promise<Result<{ comicCount: number; libraryBytes: number; cacheBytes: number }>>
  }

  importer: {
    pickFiles(): Promise<Result<string[]>>
    /** Só no preload (síncrono): resolve os `File` do drag & drop para caminhos absolutos. */
    pathsForFiles(files: FileList | File[]): string[]
    start(paths: string[]): Promise<Result<{ jobId: string }>>
    cancel(jobId: string): Promise<Result<void>>
    resolveDuplicate(
      jobId: string,
      itemId: string,
      decision: 'skip' | 'import',
      applyToAll: boolean,
    ): Promise<Result<void>>
    getJob(): Promise<Result<ImportJobState | null>>
    onProgress(callback: (state: ImportJobState) => void): () => void
    onLibraryChanged(callback: (reason: 'import' | 'delete' | 'cover') => void): () => void
  }

  collections: {
    list(type: CollectionType, sort: 'name' | 'updatedAt'): Promise<Result<CollectionSummary[]>>
    get(id: CollectionId): Promise<Result<CollectionDetail>>
    create(input: {
      type: CollectionType
      name: string
      description?: string
      comicIds?: ComicId[]
    }): Promise<Result<CollectionSummary>>
    update(
      id: CollectionId,
      patch: { name?: string; description?: string; type?: CollectionType },
    ): Promise<Result<CollectionSummary>>
    delete(id: CollectionId): Promise<Result<void>>
    addItems(id: CollectionId, comicIds: ComicId[]): Promise<Result<{ added: number }>>
    removeItems(id: CollectionId, comicIds: ComicId[]): Promise<Result<void>>
    reorder(id: CollectionId, orderedComicIds: ComicId[]): Promise<Result<void>>
    setCover(id: CollectionId, cover: CollectionCoverInput): Promise<Result<CollectionSummary>>
    pickCoverImage(): Promise<Result<string | null>>
    membership(comicIds: ComicId[]): Promise<Result<Record<CollectionId, 'all' | 'some'>>>
    nextToRead(sagaId: CollectionId): Promise<Result<ComicId | null>>
  }

  reader: {
    open(comicId: ComicId, fromCollectionId?: CollectionId): Promise<Result<ReaderSession>>
    /** Fire-and-forget: o main faz debounce e flush (docs/04 §4.4). */
    setPage(comicId: ComicId, page: number): void
    savePrefs(comicId: ComicId, prefs: ReaderPrefs): Promise<Result<void>>
    resetPrefs(comicId: ComicId): Promise<Result<ReaderPrefs>>
    complete(comicId: ComicId): Promise<Result<void>>
    reportPageSize(comicId: ComicId, index: number, width: number, height: number): void
    close(comicId: ComicId): Promise<Result<void>>
  }

  settings: {
    get(): Promise<Result<Settings>>
    update(patch: Partial<Settings>): Promise<Result<Settings>>
    resetAllReaderPrefs(): Promise<Result<void>>
  }

  app: {
    info(): Promise<Result<{ version: string; userDataPath: string }>>
    openDataFolder(): Promise<Result<void>>
    clearCache(): Promise<Result<{ freedBytes: number }>>
    toggleFullscreen(): Promise<Result<boolean>>
    onFullscreenChanged(callback: (isFullscreen: boolean) => void): () => void
  }
}
