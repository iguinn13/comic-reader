import { AppError, type Result } from '@shared/errors'
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
} from '@shared/types'

/**
 * Desembrulha um `Result<T>` vindo de `window.api`: devolve `data` no
 * sucesso e lança `AppError` na falha, para o TanStack Query tratar a chamada
 * como uma rejeição normal (docs/04-contratos-ipc.md §1 e §3).
 */
async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    throw new AppError(result.error.code, result.error.message, result.error.details)
  }
  return result.data
}

/**
 * Wrapper fino sobre `window.api`, na mesma forma de `ComicReaderApi`
 * (src/shared/api.ts): todo método que devolvia `Promise<Result<T>>` agora
 * devolve `Promise<T>` direto (ou lança `AppError`) via `unwrap`. Métodos
 * síncronos, fire-and-forget e assinantes de evento passam direto.
 */
export const api = {
  library: {
    home: () => unwrap(window.api.library.home()),
    list: (query: LibraryQuery) => unwrap(window.api.library.list(query)),
    get: (id: ComicId) => unwrap(window.api.library.get(id)),
    rename: (id: ComicId, title: string) => unwrap(window.api.library.rename(id, title)),
    setFavorite: (ids: ComicId[], value: boolean) =>
      unwrap(window.api.library.setFavorite(ids, value)),
    setReadStatus: (ids: ComicId[], status: 'read' | 'unread') =>
      unwrap(window.api.library.setReadStatus(ids, status)),
    removeFromContinue: (id: ComicId) => unwrap(window.api.library.removeFromContinue(id)),
    delete: (ids: ComicId[]) => unwrap(window.api.library.delete(ids)),
    stats: () => unwrap(window.api.library.stats()),
  },

  importer: {
    pickFiles: () => unwrap(window.api.importer.pickFiles()),
    pathsForFiles: (files: FileList | File[]): string[] => window.api.importer.pathsForFiles(files),
    start: (paths: string[]) => unwrap(window.api.importer.start(paths)),
    cancel: (jobId: string) => unwrap(window.api.importer.cancel(jobId)),
    resolveDuplicate: (
      jobId: string,
      itemId: string,
      decision: 'skip' | 'import',
      applyToAll: boolean,
    ) => unwrap(window.api.importer.resolveDuplicate(jobId, itemId, decision, applyToAll)),
    getJob: () => unwrap(window.api.importer.getJob()),
    onProgress: (callback: (state: ImportJobState) => void): (() => void) =>
      window.api.importer.onProgress(callback),
    onLibraryChanged: (callback: (reason: 'import' | 'delete' | 'cover') => void): (() => void) =>
      window.api.importer.onLibraryChanged(callback),
  },

  collections: {
    list: (type: CollectionType, sort: 'name' | 'updatedAt') =>
      unwrap(window.api.collections.list(type, sort)),
    get: (id: CollectionId) => unwrap(window.api.collections.get(id)),
    create: (input: {
      type: CollectionType
      name: string
      description?: string
      comicIds?: ComicId[]
    }) => unwrap(window.api.collections.create(input)),
    update: (
      id: CollectionId,
      patch: { name?: string; description?: string; type?: CollectionType },
    ) => unwrap(window.api.collections.update(id, patch)),
    delete: (id: CollectionId) => unwrap(window.api.collections.delete(id)),
    addItems: (id: CollectionId, comicIds: ComicId[]) =>
      unwrap(window.api.collections.addItems(id, comicIds)),
    removeItems: (id: CollectionId, comicIds: ComicId[]) =>
      unwrap(window.api.collections.removeItems(id, comicIds)),
    reorder: (id: CollectionId, orderedComicIds: ComicId[]) =>
      unwrap(window.api.collections.reorder(id, orderedComicIds)),
    setCover: (id: CollectionId, cover: CollectionCoverInput) =>
      unwrap(window.api.collections.setCover(id, cover)),
    pickCoverImage: () => unwrap(window.api.collections.pickCoverImage()),
    membership: (comicIds: ComicId[]) => unwrap(window.api.collections.membership(comicIds)),
    nextToRead: (sagaId: CollectionId) => unwrap(window.api.collections.nextToRead(sagaId)),
  },

  reader: {
    open: (comicId: ComicId, fromCollectionId?: CollectionId) =>
      unwrap(window.api.reader.open(comicId, fromCollectionId)),
    setPage: (comicId: ComicId, page: number): void => window.api.reader.setPage(comicId, page),
    savePrefs: (comicId: ComicId, prefs: ReaderPrefs) =>
      unwrap(window.api.reader.savePrefs(comicId, prefs)),
    resetPrefs: (comicId: ComicId) => unwrap(window.api.reader.resetPrefs(comicId)),
    complete: (comicId: ComicId) => unwrap(window.api.reader.complete(comicId)),
    reportPageSize: (comicId: ComicId, index: number, width: number, height: number): void =>
      window.api.reader.reportPageSize(comicId, index, width, height),
    close: (comicId: ComicId) => unwrap(window.api.reader.close(comicId)),
  },

  settings: {
    get: () => unwrap(window.api.settings.get()),
    update: (patch: Partial<Settings>) => unwrap(window.api.settings.update(patch)),
    resetAllReaderPrefs: () => unwrap(window.api.settings.resetAllReaderPrefs()),
  },

  app: {
    info: () => unwrap(window.api.app.info()),
    openDataFolder: () => unwrap(window.api.app.openDataFolder()),
    clearCache: () => unwrap(window.api.app.clearCache()),
    toggleFullscreen: () => unwrap(window.api.app.toggleFullscreen()),
    onFullscreenChanged: (callback: (isFullscreen: boolean) => void): (() => void) =>
      window.api.app.onFullscreenChanged(callback),
  },
}

// Tipos re-exportados por conveniência para quem consumir `lib/api.ts` sem
// precisar importar `@shared/types` separadamente.
export type {
  CollectionDetail,
  CollectionSummary,
  ComicDetail,
  ComicSummary,
  HomeData,
  ImportJobState,
  Page,
  ReaderSession,
  Settings,
}
