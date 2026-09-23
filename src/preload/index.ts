import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { CH } from '@shared/channels'
import type { Result } from '@shared/errors'
import type { ComicReaderApi } from '@shared/api'

/**
 * Só o preload roda com acesso ao Node, então ele é o único lugar autorizado
 * a construir `window.api`. Nada além de funções de domínio explícitas passa
 * daqui para o renderer — nunca `ipcRenderer`, `require` ou `process` crus
 * (checklist de segurança em docs/02-arquitetura.md §6).
 *
 * Cada método chama `ipcRenderer.invoke` num canal de `src/shared/channels.ts`
 * e devolve `Result<T>` (docs/04-contratos-ipc.md §1). Três exceções ao
 * padrão request/response, documentadas em `src/shared/api.ts`:
 * - `reader.setPage`/`reader.reportPageSize`: fire-and-forget, sem `Promise`.
 * - `importer.pathsForFiles`: não é IPC, resolve `File` → caminho no próprio
 *   preload via `webUtils.getPathForFile`.
 * - Os métodos `on*`: registram um listener de evento e devolvem a função de
 *   unsubscribe.
 */

/** `ipcRenderer.invoke` tipado: único ponto que "confia" no retorno do main. */
function invoke<T>(channel: string, ...args: unknown[]): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<Result<T>>
}

/** Registra um listener de evento main → renderer e devolve o unsubscribe. */
function on<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ComicReaderApi = {
  library: {
    home: () => invoke(CH.library.home),
    list: (query) => invoke(CH.library.list, query),
    get: (id) => invoke(CH.library.get, id),
    rename: (id, title) => invoke(CH.library.rename, id, title),
    setFavorite: (ids, value) => invoke(CH.library.setFavorite, ids, value),
    setReadStatus: (ids, status) => invoke(CH.library.setReadStatus, ids, status),
    removeFromContinue: (id) => invoke(CH.library.removeFromContinue, id),
    delete: (ids) => invoke(CH.library.delete, ids),
    stats: () => invoke(CH.library.stats),
  },

  importer: {
    pickFiles: () => invoke(CH.importer.pickFiles),
    pathsForFiles: (files) => Array.from(files).map((file) => webUtils.getPathForFile(file)),
    start: (paths) => invoke(CH.importer.start, paths),
    cancel: (jobId) => invoke(CH.importer.cancel, jobId),
    resolveDuplicate: (jobId, itemId, decision, applyToAll) =>
      invoke(CH.importer.resolveDuplicate, jobId, itemId, decision, applyToAll),
    getJob: () => invoke(CH.importer.getJob),
    onProgress: (callback) => on(CH.importer.onProgress, callback),
    onLibraryChanged: (callback) => on(CH.importer.onLibraryChanged, callback),
  },

  collections: {
    list: (type, sort) => invoke(CH.collections.list, type, sort),
    get: (id) => invoke(CH.collections.get, id),
    create: (input) => invoke(CH.collections.create, input),
    update: (id, patch) => invoke(CH.collections.update, id, patch),
    delete: (id) => invoke(CH.collections.delete, id),
    addItems: (id, comicIds) => invoke(CH.collections.addItems, id, comicIds),
    removeItems: (id, comicIds) => invoke(CH.collections.removeItems, id, comicIds),
    reorder: (id, orderedComicIds) => invoke(CH.collections.reorder, id, orderedComicIds),
    setCover: (id, cover) => invoke(CH.collections.setCover, id, cover),
    pickCoverImage: () => invoke(CH.collections.pickCoverImage),
    membership: (comicIds) => invoke(CH.collections.membership, comicIds),
    nextToRead: (sagaId) => invoke(CH.collections.nextToRead, sagaId),
  },

  reader: {
    open: (comicId, fromCollectionId) => invoke(CH.reader.open, comicId, fromCollectionId),
    setPage: (comicId, page) => void ipcRenderer.invoke(CH.reader.setPage, comicId, page),
    savePrefs: (comicId, prefs) => invoke(CH.reader.savePrefs, comicId, prefs),
    resetPrefs: (comicId) => invoke(CH.reader.resetPrefs, comicId),
    complete: (comicId) => invoke(CH.reader.complete, comicId),
    reportPageSize: (comicId, index, width, height) =>
      void ipcRenderer.invoke(CH.reader.reportPageSize, comicId, index, width, height),
    close: (comicId) => invoke(CH.reader.close, comicId),
  },

  settings: {
    get: () => invoke(CH.settings.get),
    update: (patch) => invoke(CH.settings.update, patch),
    resetAllReaderPrefs: () => invoke(CH.settings.resetAllReaderPrefs),
  },

  app: {
    info: () => invoke(CH.app.info),
    openDataFolder: () => invoke(CH.app.openDataFolder),
    clearCache: () => invoke(CH.app.clearCache),
    toggleFullscreen: () => invoke(CH.app.toggleFullscreen),
    onFullscreenChanged: (callback) => on(CH.app.onFullscreenChanged, callback),
  },
}

const versions = {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
} as const

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('versions', versions)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error — só ocorre se contextIsolation for desligada (não deve acontecer, ver window.ts)
  window.api = api
  // @ts-expect-error — idem
  window.versions = versions
}
