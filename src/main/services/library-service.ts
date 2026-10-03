import { rm } from 'fs/promises'
import { basename, join, relative, isAbsolute, sep } from 'path'
import { AppError } from '@shared/errors'
import type {
  ComicDetail,
  ComicId,
  ComicSummary,
  DeleteComicOptions,
  FolderContents,
  FolderLocation,
  HomeData,
  LibraryQuery,
  Page,
} from '@shared/types'
import { naturalSort } from '../archive'
import type { Db } from '../db/client'
import {
  deleteComics,
  getComicFileMeta,
  getComicDetail,
  listComicRowsInFolder,
  listComics,
  renameComic,
  setFavorite,
  type ComicRow,
} from '../db/repositories/comics'
import { getLibraryFolder, listLibraryFolders } from '../db/repositories/library-folders'
import {
  getContinueReading,
  getRecentlyAdded,
  markReadAndRewind,
  markUnread,
} from '../db/repositories/progress'
import { logger } from '../utils/logger'
import type { AppPaths } from '../utils/paths'
import { normalizeText } from '../utils/normalize'
import type { FolderCoverService } from './folder-cover-service'
import { comicCoverUrl, toComicDetail, toComicSummary } from './comic-dto'
const HOME_LIST_LIMIT = 20
function isInsideAnyFolder(filePath: string, folderPaths: string[]): boolean {
  return folderPaths.some((folder) => {
    const rel = relative(folder.toLowerCase(), filePath.toLowerCase())
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  })
}
function firstCoverUrl(rows: ComicRow[]): string | null {
  const byPath = new Map(rows.map((row) => [row.filePath, row]))
  for (const path of naturalSort([...byPath.keys()])) {
    const row = byPath.get(path)!
    const url = comicCoverUrl(row.id, row.coverVersion)
    if (url) return url
  }
  return null
}
export class LibraryService {
  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
    private readonly folderCovers: Pick<FolderCoverService, 'coverUrl'> = {
      coverUrl: () => null,
    },
  ) {}
  list(query: LibraryQuery): Page<ComicSummary> {
    const result = listComics(this.db, {
      searchNormalized: query.search ? normalizeText(query.search) : undefined,
      sort: query.sort,
      order: query.order,
      status: query.status,
      favoritesOnly: query.favoritesOnly,
      limit: query.limit,
      offset: query.offset,
    })
    return { items: result.items.map(toComicSummary), total: result.total }
  }
  get(id: ComicId): ComicDetail {
    const row = getComicDetail(this.db, id)
    if (!row) throw new AppError('NOT_FOUND', 'errors.comicNotFound')
    return toComicDetail(row)
  }
  rename(id: ComicId, title: string): ComicSummary {
    this.get(id)
    renameComic(this.db, id, title, normalizeText(title))
    return toComicSummary(getComicDetail(this.db, id)!)
  }
  setFavorite(ids: ComicId[], value: boolean): void {
    for (const id of ids) setFavorite(this.db, id, value)
  }
  setReadStatus(ids: ComicId[], status: 'read' | 'unread'): void {
    const mark = status === 'read' ? markReadAndRewind : markUnread
    for (const id of ids) mark(this.db, id)
  }
  async delete(
    ids: ComicId[],
    options: DeleteComicOptions,
  ): Promise<{
    deleted: number
  }> {
    const folderPaths = options.deleteFile ? listLibraryFolders(this.db).map((f) => f.path) : []
    const appFiles: string[] = []
    const filesToDelete: string[] = []
    for (const id of ids) {
      const meta = getComicFileMeta(this.db, id)
      if (!meta) continue
      appFiles.push(this.paths.comicCoverFile(id), this.paths.comicPagesCacheDir(id))
      if (!options.deleteFile) continue
      if (isInsideAnyFolder(meta.filePath, folderPaths)) {
        filesToDelete.push(meta.filePath)
      } else {
        logger.warn(
          `[library] "${meta.filePath}" não está em nenhuma pasta configurada; arquivo não apagado`,
        )
      }
    }
    const deleted = deleteComics(this.db, ids)
    await Promise.all(
      [...appFiles, ...filesToDelete].map((file) =>
        rm(file, { recursive: true, force: true }).catch(() => {}),
      ),
    )
    return { deleted }
  }
  home(): HomeData {
    return {
      continueReading: getContinueReading(this.db, HOME_LIST_LIMIT).map(toComicSummary),
      recentlyAdded: getRecentlyAdded(this.db, HOME_LIST_LIMIT).map(toComicSummary),
    }
  }
  browseFolder(location: FolderLocation): FolderContents {
    if (location.folderId === null) {
      const subfolders: FolderContents['subfolders'] = []
      const comics: ComicSummary[] = []
      for (const folder of listLibraryFolders(this.db)) {
        const inside = this.browseFolder({ folderId: folder.id, relativePath: '' })
        if (inside.subfolders.length > 0) {
          subfolders.push(...inside.subfolders)
          comics.push(...inside.comics)
          continue
        }
        const hasDirectComics = inside.comics.length > 0
        subfolders.push({
          name: basename(folder.path),
          folderId: folder.id,
          relativePath: '',
          comicCount: inside.comics.length,
          coverUrl: hasDirectComics
            ? (inside.comics.find((comic) => comic.coverUrl)?.coverUrl ?? null)
            : this.folderCovers.coverUrl({ folderId: folder.id, relativePath: '' }),
          hasDirectComics,
        })
      }
      return { subfolders, comics }
    }
    const folder = getLibraryFolder(this.db, location.folderId)
    if (!folder) throw new AppError('NOT_FOUND', 'errors.folderNotFound')
    const prefix = location.relativePath ? join(folder.path, location.relativePath) : folder.path
    const rows = listComicRowsInFolder(this.db, location.folderId)
    const directRows: ComicRow[] = []
    const subfolderCounts = new Map<string, number>()
    const subfolderDirectRows = new Map<string, ComicRow[]>()
    for (const row of rows) {
      const rel = relative(prefix, row.filePath)
      if (rel.startsWith('..') || isAbsolute(rel)) continue
      const parts = rel.split(sep)
      if (parts.length === 1) {
        directRows.push(row)
      } else {
        subfolderCounts.set(parts[0], (subfolderCounts.get(parts[0]) ?? 0) + 1)
        if (parts.length === 2) {
          const list = subfolderDirectRows.get(parts[0]) ?? []
          list.push(row)
          subfolderDirectRows.set(parts[0], list)
        }
      }
    }
    const sortedNames = naturalSort([...subfolderCounts.keys()])
    const subfolders = sortedNames.map((name) => {
      const relativePath = location.relativePath ? `${location.relativePath}/${name}` : name
      const directComics = subfolderDirectRows.get(name) ?? []
      const hasDirectComics = directComics.length > 0
      return {
        name,
        folderId: location.folderId!,
        relativePath,
        comicCount: subfolderCounts.get(name)!,
        coverUrl: hasDirectComics
          ? firstCoverUrl(directComics)
          : this.folderCovers.coverUrl({ folderId: location.folderId!, relativePath }),
        hasDirectComics,
      }
    })
    const sortedPaths = naturalSort(directRows.map((row) => row.filePath))
    const byPath = new Map(directRows.map((row) => [row.filePath, row]))
    const comics = sortedPaths.map((path) => toComicSummary(byPath.get(path)!))
    return { subfolders, comics }
  }
}
