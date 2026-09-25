import type { Result } from './errors'
import type {
  ComicDetail,
  ComicId,
  ComicSummary,
  DeleteComicOptions,
  FolderContents,
  FolderLocation,
  HomeData,
  LibraryFolder,
  LibraryQuery,
  LibraryScanState,
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
    delete(ids: ComicId[], options: DeleteComicOptions): Promise<Result<{ deleted: number }>>
    stats(): Promise<Result<{ comicCount: number; libraryBytes: number; cacheBytes: number }>>
    /** Re-escaneia todas as pastas-raiz configuradas (docs/05). */
    scan(): Promise<Result<void>>
    onScanProgress(callback: (state: LibraryScanState) => void): () => void
    onChanged(callback: (reason: 'scan' | 'delete' | 'cover') => void): () => void
    /** RF-64: subpastas e HQs de um nível da navegação por pastas. */
    browseFolder(location: FolderLocation): Promise<Result<FolderContents>>
    /** Abre o seletor de imagem e define a capa da pasta; `false` se o usuário cancelou. */
    setFolderCover(location: FolderLocation): Promise<Result<boolean>>
    clearFolderCover(location: FolderLocation): Promise<Result<void>>
  }

  libraryFolders: {
    list(): Promise<Result<LibraryFolder[]>>
    /** Abre o diálogo de escolha de pasta; null se o usuário cancelar. */
    add(): Promise<Result<LibraryFolder | null>>
    remove(id: string): Promise<Result<void>>
  }

  reader: {
    open(comicId: ComicId): Promise<Result<ReaderSession>>
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
    /** Sem `force` alterna; com `force` define o estado (idempotente). */
    toggleFullscreen(force?: boolean): Promise<Result<boolean>>
    onFullscreenChanged(callback: (isFullscreen: boolean) => void): () => void
  }
}
