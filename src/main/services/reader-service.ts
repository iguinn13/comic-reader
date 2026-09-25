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

/** docs/04-contratos-ipc.md §4.4: debounce de `setPage` por HQ. */
const SET_PAGE_DEBOUNCE_MS = 500

/**
 * Sessão de leitura, progresso e preferências (docs/06-leitor.md, RF-30..44).
 * `nextInFolder` é o próximo arquivo (ordem natural) na mesma pasta, usado
 * pelo painel de fim de leitura (RF-42) — substitui a antiga navegação por
 * saga: a organização agora é inteiramente a estrutura de pastas do usuário.
 */
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

  /** Fire-and-forget (docs/04 §4.4): grava em memória e faz debounce da escrita no banco. */
  setPage(comicId: ComicId, page: number): void {
    this.pendingPages.set(comicId, page)
    const existingTimer = this.flushTimers.get(comicId)
    if (existingTimer) clearTimeout(existingTimer)
    this.flushTimers.set(
      comicId,
      setTimeout(() => this.flushOne(comicId), SET_PAGE_DEBOUNCE_MS),
    )
  }

  /** `close`, `before-quit` e `render-process-gone` chamam sem argumento pra gravar tudo pendente. */
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
    markRead(this.db, comicId)
  }

  /**
   * Dimensão medida no renderer (PDF, ou fallback quando `image-size` falhou
   * no main). Em CBZ/CBR atualiza a linha existente; em PDF não há linha em
   * `comic_pages` (docs/03 §2.2), então isto vira um no-op silencioso — só a
   * sessão em memória do renderer usa essa dimensão nesse caso.
   */
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
