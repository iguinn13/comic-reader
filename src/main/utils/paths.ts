import { join } from 'path'

/**
 * Layout de disco do app, documentado em docs/03-modelo-de-dados.md §3.
 *
 * Implementado como uma fábrica que recebe a raiz de `userData` em vez de
 * chamar `app.getPath('userData')` diretamente, para que os serviços do main
 * possam ser testados com Vitest em Node puro, sem depender do Electron
 * estar rodando (ver docs/02-arquitetura.md §3: "Serviços não importam
 * electron diretamente... isso permite testar os serviços em Node puro").
 */

export interface AppPaths {
  /** Raiz de dados do usuário (equivalente a app.getPath('userData')). */
  readonly root: string

  /** Banco SQLite (mais os arquivos -wal e -shm ao lado, gerenciados pelo driver). */
  readonly dbFile: string

  /** Miniaturas (capas) geradas pelo app — as HQs em si ficam nas pastas do usuário (docs/10 ADR). */
  readonly coversDir: string
  readonly coversComicsDir: string
  comicCoverFile(comicId: string): string
  /** Capas escolhidas pelo usuário para pastas (docs/03 §3); `key` é o hash de `folderCoverKey`. */
  readonly coversFoldersDir: string
  folderCoverFile(key: string): string

  /** Cache descartável de páginas extraídas. */
  readonly cacheDir: string
  readonly cachePagesDir: string
  comicPagesCacheDir(comicId: string): string
  comicPageCacheFile(comicId: string, pageIndex: number, extension: string): string
  comicPagesCompleteMarker(comicId: string): string

  /** Logs do app (electron-log). */
  readonly logsDir: string

  /** Todos os diretórios que precisam existir antes do app usar o disco. */
  readonly allDirectories: readonly string[]
}

export function createAppPaths(userDataRoot: string): AppPaths {
  const coversDir = join(userDataRoot, 'covers')
  const coversComicsDir = join(coversDir, 'comics')
  const coversFoldersDir = join(coversDir, 'folders')
  const cacheDir = join(userDataRoot, 'cache')
  const cachePagesDir = join(cacheDir, 'pages')
  const logsDir = join(userDataRoot, 'logs')

  const paths: AppPaths = {
    root: userDataRoot,
    dbFile: join(userDataRoot, 'comic-reader.db'),

    coversDir,
    coversComicsDir,
    comicCoverFile: (comicId) => join(coversComicsDir, `${comicId}.jpg`),
    coversFoldersDir,
    folderCoverFile: (key) => join(coversFoldersDir, `${key}.jpg`),

    cacheDir,
    cachePagesDir,
    comicPagesCacheDir: (comicId) => join(cachePagesDir, comicId),
    comicPageCacheFile: (comicId, pageIndex, extension) =>
      join(cachePagesDir, comicId, `${String(pageIndex).padStart(4, '0')}.${extension}`),
    comicPagesCompleteMarker: (comicId) => join(cachePagesDir, comicId, '.complete'),

    logsDir,

    allDirectories: [coversComicsDir, coversFoldersDir, cachePagesDir, logsDir],
  }

  return paths
}
