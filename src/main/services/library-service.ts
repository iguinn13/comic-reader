import { rm } from 'fs/promises'
import { relative, isAbsolute } from 'path'
import { AppError } from '@shared/errors'
import type {
  ComicDetail,
  ComicId,
  ComicSummary,
  DeleteComicOptions,
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
import { listLibraryFolders } from '../db/repositories/library-folders'
import {
  getContinueReading,
  getRecentlyAdded,
  markRead,
  markUnread,
} from '../db/repositories/progress'
import { logger } from '../utils/logger'
import type { AppPaths } from '../utils/paths'
import { normalizeText } from '../utils/normalize'
import { toComicDetail, toComicSummary } from './comic-dto'

const HOME_LIST_LIMIT = 20

/** Se `filePath` está de fato dentro de alguma pasta-raiz configurada (comparação case-insensitive, Windows). */
function isInsideAnyFolder(filePath: string, folderPaths: string[]): boolean {
  return folderPaths.some((folder) => {
    const rel = relative(folder.toLowerCase(), filePath.toLowerCase())
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  })
}

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
    const mark = status === 'read' ? markRead : markUnread
    for (const id of ids) mark(this.db, id)
  }

  /**
   * Remove a HQ do índice (progresso e páginas em cascata) e sempre limpa a
   * capa e o cache do app. O arquivo original só é apagado do disco se
   * `deleteFile` for true — e, mesmo assim, só depois de confirmar que ele
   * ainda está dentro de alguma pasta-raiz configurada (o usuário organiza os
   * arquivos fora do app, docs/10 ADR).
   */
  async delete(ids: ComicId[], options: DeleteComicOptions): Promise<{ deleted: number }> {
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
    // Só depois do banco: se apagar o arquivo falhar, sobra só um órfão em disco (sem risco pro índice).
    await Promise.all(
      [...appFiles, ...filesToDelete].map((file) =>
        rm(file, { recursive: true, force: true }).catch(() => {}),
      ),
    )
    return { deleted }
  }

  /** RF-11/RF-63: "Continuar lendo" e "Adicionadas recentemente". */
  home(): HomeData {
    return {
      continueReading: getContinueReading(this.db, HOME_LIST_LIMIT).map(toComicSummary),
      recentlyAdded: getRecentlyAdded(this.db, HOME_LIST_LIMIT).map(toComicSummary),
    }
  }
}
