import { existsSync } from 'fs'
import { AppError } from '@shared/errors'
import type {
  CollectionId,
  ComicFormat,
  ComicId,
  ReaderPrefs,
  ReaderSession,
  SagaContext,
  ReaderSource,
} from '@shared/types'
import type { Db } from '../db/client'
import { getNextToRead, getSagasContainingComic } from '../db/repositories/collections'
import { getComicDetail } from '../db/repositories/comics'
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
import { FORMAT_TO_FILE_EXT } from '../utils/comic-format'
import type { AppPaths } from '../utils/paths'
import type { PageCacheService } from './page-cache-service'

/** docs/04-contratos-ipc.md §4.4: debounce de `setPage` por HQ. */
const SET_PAGE_DEBOUNCE_MS = 500

/**
 * Sessão de leitura, progresso e preferências (docs/06-leitor.md, RF-30..44).
 * `sagaContext` lista as sagas que contêm a HQ (RF-42), com a saga de origem
 * (`fromCollectionId`) primeiro.
 */
export class ReaderService {
  private readonly pendingPages = new Map<ComicId, number>()
  private readonly flushTimers = new Map<ComicId, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
    private readonly pageCache: PageCacheService,
  ) {}

  open(comicId: ComicId, fromCollectionId?: CollectionId): ReaderSession {
    const row = getComicDetail(this.db, comicId)
    if (!row) throw new AppError('NOT_FOUND', 'errors.comicNotFound')

    const fileExt = FORMAT_TO_FILE_EXT[row.format]
    if (!existsSync(this.paths.comicFile(comicId, fileExt))) {
      throw new AppError('FILE_MISSING', 'errors.fileMissing')
    }

    if (row.format !== 'pdf') this.pageCache.ensure(comicId, row.currentPage)

    const customPrefs = getReaderPrefs(this.db, comicId)
    const defaults = getSetting(this.db, 'reader.defaults')

    return {
      comic: toComicDetail(this.db, row),
      source: buildSource(comicId, row.format, this.db),
      currentPage: row.currentPage,
      prefs: customPrefs ?? defaults,
      hasCustomPrefs: customPrefs !== null,
      sagaContext: buildSagaContext(this.db, comicId, fromCollectionId),
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

function buildSource(comicId: ComicId, format: ComicFormat, db: Db): ReaderSource {
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

function buildSagaContext(
  db: Db,
  comicId: ComicId,
  fromCollectionId?: CollectionId,
): SagaContext[] {
  const sagas = getSagasContainingComic(db, comicId)
  sagas.sort((a, b) => Number(b.id === fromCollectionId) - Number(a.id === fromCollectionId))

  return sagas.map((saga) => {
    const nextId = getNextToRead(db, saga.id, comicId)
    const nextRow = nextId ? getComicDetail(db, nextId) : null
    return {
      sagaId: saga.id,
      sagaName: saga.name,
      position: saga.position,
      total: saga.total,
      next: nextRow ? toComicSummary(nextRow) : null,
    }
  })
}
