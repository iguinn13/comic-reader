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

export type ComicFileFormat = 'cbz' | 'cbr' | 'pdf'

export interface AppPaths {
  /** Raiz de dados do usuário (equivalente a app.getPath('userData')). */
  readonly root: string

  /** Banco SQLite (mais os arquivos -wal e -shm ao lado, gerenciados pelo driver). */
  readonly dbFile: string

  /** Cópias das HQs importadas. */
  readonly libraryDir: string
  /** Caminho do arquivo de uma HQ na biblioteca, pelo id e formato real. */
  comicFile(comicId: string, format: ComicFileFormat): string

  /** Miniaturas (capas). */
  readonly coversDir: string
  readonly coversComicsDir: string
  readonly coversCollectionsDir: string
  comicCoverFile(comicId: string): string
  collectionCoverFile(collectionId: string): string

  /** Cache descartável de páginas extraídas e área de trabalho da importação. */
  readonly cacheDir: string
  readonly cachePagesDir: string
  readonly cacheTmpDir: string
  comicPagesCacheDir(comicId: string): string
  comicPageCacheFile(comicId: string, pageIndex: number, extension: string): string
  comicPagesCompleteMarker(comicId: string): string
  importTmpFile(itemId: string): string

  /** Logs do app (electron-log). */
  readonly logsDir: string

  /** Todos os diretórios que precisam existir antes do app usar o disco. */
  readonly allDirectories: readonly string[]
}

export function createAppPaths(userDataRoot: string): AppPaths {
  const libraryDir = join(userDataRoot, 'library')
  const coversDir = join(userDataRoot, 'covers')
  const coversComicsDir = join(coversDir, 'comics')
  const coversCollectionsDir = join(coversDir, 'collections')
  const cacheDir = join(userDataRoot, 'cache')
  const cachePagesDir = join(cacheDir, 'pages')
  const cacheTmpDir = join(cacheDir, 'tmp')
  const logsDir = join(userDataRoot, 'logs')

  const paths: AppPaths = {
    root: userDataRoot,
    dbFile: join(userDataRoot, 'comic-reader.db'),

    libraryDir,
    comicFile: (comicId, format) => join(libraryDir, `${comicId}.${format}`),

    coversDir,
    coversComicsDir,
    coversCollectionsDir,
    comicCoverFile: (comicId) => join(coversComicsDir, `${comicId}.jpg`),
    collectionCoverFile: (collectionId) => join(coversCollectionsDir, `${collectionId}.jpg`),

    cacheDir,
    cachePagesDir,
    cacheTmpDir,
    comicPagesCacheDir: (comicId) => join(cachePagesDir, comicId),
    comicPageCacheFile: (comicId, pageIndex, extension) =>
      join(cachePagesDir, comicId, `${String(pageIndex).padStart(4, '0')}.${extension}`),
    comicPagesCompleteMarker: (comicId) => join(cachePagesDir, comicId, '.complete'),
    importTmpFile: (itemId) => join(cacheTmpDir, `${itemId}.part`),

    logsDir,

    allDirectories: [
      libraryDir,
      coversComicsDir,
      coversCollectionsDir,
      cachePagesDir,
      cacheTmpDir,
      logsDir,
    ],
  }

  return paths
}
