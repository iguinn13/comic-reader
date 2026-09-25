import { rm } from 'fs/promises'
import { AppError } from '@shared/errors'
import type {
  ComicDetail,
  ComicId,
  ComicSummary,
  HomeData,
  LibraryQuery,
  Page,
} from '@shared/types'
import type { Db } from '../db/client'
import {
  deleteComics,
  getComicFileMeta,
  getComicDetail,
  listComics,
  renameComic,
  setFavorite,
} from '../db/repositories/comics'
import {
  getContinueReading,
  getRecentlyAdded,
  markRead,
  markUnread,
} from '../db/repositories/progress'
import { FORMAT_TO_FILE_EXT } from '../utils/comic-format'
import type { AppPaths } from '../utils/paths'
import { normalizeText } from '../utils/normalize'
import { listSagasInProgress } from '../db/repositories/collections'
import { toCollectionSummary } from './collection-dto'
import { toComicDetail, toComicSummary } from './comic-dto'

const HOME_LIST_LIMIT = 20
const HOME_SAGAS_LIMIT = 10

/**
 * Consulta e ações sobre a biblioteca (docs/02-arquitetura.md §3.1,
 * RF-10..19). A busca/filtro/ordenação/paginação em si já vivem no
 * repositório (`listComics`); este serviço normaliza o input de busca, monta
 * os DTOs (com a URL `comic://` da capa) e valida existência antes de agir.
 */
export class LibraryService {
  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
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
    return toComicDetail(this.db, row)
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
    const mark = status === 'read' ? markRead : markUnread
    for (const id of ids) mark(this.db, id)
  }

  /** RF-17: apaga o registro (progresso e itens de coleção em cascata) e depois o arquivo, a capa e o cache da HQ. */
  async delete(ids: ComicId[]): Promise<{ deleted: number }> {
    const files = ids.flatMap((id) => {
      const meta = getComicFileMeta(this.db, id)
      if (!meta) return []
      return [
        this.paths.comicFile(id, FORMAT_TO_FILE_EXT[meta.format]),
        this.paths.comicCoverFile(id),
        this.paths.comicPagesCacheDir(id),
      ]
    })
    const deleted = deleteComics(this.db, ids)
    // Só depois do banco: se apagar o arquivo falhar, o `MaintenanceService` limpa o órfão no boot.
    await Promise.all(
      files.map((file) => rm(file, { recursive: true, force: true }).catch(() => {})),
    )
    return { deleted }
  }

  /** RF-11/RF-63: "Continuar lendo", "Sagas em andamento" e "Adicionadas recentemente". */
  home(): HomeData {
    return {
      continueReading: getContinueReading(this.db, HOME_LIST_LIMIT).map(toComicSummary),
      sagasInProgress: listSagasInProgress(this.db, HOME_SAGAS_LIMIT).map((row) =>
        toCollectionSummary(this.db, row),
      ),
      recentlyAdded: getRecentlyAdded(this.db, HOME_LIST_LIMIT).map(toComicSummary),
    }
  }
}
