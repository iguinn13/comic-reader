import { existsSync } from 'fs'
import { AppError } from '@shared/errors'
import type { ComicFormat, ComicId, ReaderPrefs, ReaderSession, ReaderSource } from '@shared/types'
import { naturalSort } from '../archive'
import type { Db } from '../db/client'
import { getComicDetail, listComicsInDir } from '../db/repositories/comics'
import { listComicPages, updatePageDimensions } from '../db/repositories/pages'
import {
  getReaderPrefs,
  markRead,
  resetReaderPrefs,
  setCurrentPage,
  setReaderPrefs,
} from '../db/repositories/progress'
import { getSetting } from '../db/repositories/settings'
import { toComicDetail, toComicSummary } from './comic-dto'
import type { PageCacheService } from './page-cache-service'
const SET_PAGE_DEBOUNCE_MS = 500
export class ReaderService {
  private readonly pendingPages = new Map<ComicId, number>()
  private readonly flushTimers = new Map<ComicId, ReturnType<typeof setTimeout>>()
  constructor(
    private readonly db: Db,
    private readonly pageCache: PageCacheService,
  ) {}
  open(comicId: ComicId): ReaderSession {
    const row = getComicDetail(this.db, comicId)
    if (!row) throw new AppError('NOT_FOUND', 'errors.comicNotFound')
    if (!existsSync(row.filePath)) {
      throw new AppError('FILE_MISSING', 'errors.fileMissing')
    }
    if (row.format !== 'pdf') this.pageCache.ensure(comicId, row.currentPage)
    const customPrefs = getReaderPrefs(this.db, comicId)
    const defaults = getSetting(this.db, 'reader.defaults')
    return {
      comic: toComicDetail(row),
      source: buildSource(this.db, comicId, row.format),
      currentPage: row.currentPage,
      prefs: customPrefs ?? defaults,
      hasCustomPrefs: customPrefs !== null,
      nextInFolder: getNextInFolder(this.db, comicId, row.dirPath, row.filePath),
    }
  }
  setPage(comicId: ComicId, page: number): void {
    this.pendingPages.set(comicId, page)
    const existingTimer = this.flushTimers.get(comicId)
    if (existingTimer) clearTimeout(existingTimer)
    this.flushTimers.set(
      comicId,
      setTimeout(() => this.flushOne(comicId), SET_PAGE_DEBOUNCE_MS),
    )
  }
  flush(comicId?: ComicId): void {
    if (comicId) {
      this.flushOne(comicId)
      return
    }
    for (const id of [...this.pendingPages.keys()]) this.flushOne(id)
  }
  private flushOne(comicId: ComicId): void {
    const timer = this.flushTimers.get(comicId)
    if (timer) clearTimeout(timer)
    this.flushTimers.delete(comicId)
    const page = this.pendingPages.get(comicId)
    if (page === undefined) return
    this.pendingPages.delete(comicId)
    setCurrentPage(this.db, comicId, page)
  }
  savePrefs(comicId: ComicId, prefs: ReaderPrefs): void {
    setReaderPrefs(this.db, comicId, prefs)
  }
  resetPrefs(comicId: ComicId): ReaderPrefs {
    resetReaderPrefs(this.db, comicId)
    return getSetting(this.db, 'reader.defaults')
  }
  complete(comicId: ComicId): void {
    this.flushOne(comicId)
    markRead(this.db, comicId)
  }
  reportPageSize(comicId: ComicId, index: number, width: number, height: number): void {
    updatePageDimensions(this.db, comicId, [{ pageIndex: index, width, height }])
  }
  close(comicId: ComicId): void {
    this.flushOne(comicId)
  }
}
function buildSource(db: Db, comicId: ComicId, format: ComicFormat): ReaderSource {
  if (format === 'pdf') return { kind: 'pdf', fileUrl: `comic://file/${comicId}` }
  return {
    kind: 'images',
    pages: listComicPages(db, comicId).map((page) => ({
      index: page.pageIndex,
      url: `comic://page/${comicId}/${page.pageIndex}`,
      width: page.width,
      height: page.height,
    })),
  }
}
function getNextInFolder(
  db: Db,
  comicId: ComicId,
  dirPath: string,
  filePath: string,
): ReaderSession['nextInFolder'] {
  const siblings = listComicsInDir(db, dirPath)
  const sortedPaths = naturalSort(siblings.map((s) => s.filePath))
  const currentIndex = sortedPaths.indexOf(filePath)
  const nextPath = currentIndex >= 0 ? sortedPaths[currentIndex + 1] : undefined
  if (!nextPath) return null
  const nextId = siblings.find((s) => s.filePath === nextPath)?.id
  if (!nextId || nextId === comicId) return null
  const nextRow = getComicDetail(db, nextId)
  return nextRow ? toComicSummary(nextRow) : null
}
