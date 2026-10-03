import { join } from 'path'
export interface AppPaths {
  readonly root: string
  readonly dbFile: string
  readonly coversDir: string
  readonly coversComicsDir: string
  comicCoverFile(comicId: string): string
  readonly coversFoldersDir: string
  folderCoverFile(key: string): string
  readonly cacheDir: string
  readonly cachePagesDir: string
  comicPagesCacheDir(comicId: string): string
  comicPageCacheFile(comicId: string, pageIndex: number, extension: string): string
  comicPagesCompleteMarker(comicId: string): string
  readonly logsDir: string
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
