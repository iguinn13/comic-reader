import type { ComicDetail, ComicSummary } from '@shared/types'
import type { ComicRow } from '../db/repositories/comics'

/**
 * Monta os DTOs de HQ a partir da linha do banco (docs/02-arquitetura.md
 * §3.1). Compartilhado por `LibraryService` e `ReaderService` pra não
 * duplicar a URL versionada da capa e o cálculo de `progress`. Nunca expõe
 * `filePath`/`dirPath`: o renderer só conhece IDs (regras de arquitetura).
 */

/** Monta a URL versionada da capa (docs/02-arquitetura.md §5); `null` = ainda sem capa gerada. */
export function comicCoverUrl(comicId: string, coverVersion: number): string | null {
  return coverVersion > 0 ? `comic://cover/comic/${comicId}?v=${coverVersion}` : null
}

export function toComicSummary(row: ComicRow): ComicSummary {
  return {
    id: row.id,
    title: row.title,
    format: row.format,
    pageCount: row.pageCount,
    coverUrl: comicCoverUrl(row.id, row.coverVersion),
    isFavorite: row.isFavorite,
    status: row.status,
    currentPage: row.currentPage,
    progress: row.completedAt !== null ? 1 : (row.currentPage + 1) / row.pageCount,
    lastReadAt: row.lastReadAt,
    createdAt: row.createdAt,
  }
}

export function toComicDetail(row: ComicRow): ComicDetail {
  return {
    ...toComicSummary(row),
    originalFileName: row.originalFileName,
    fileSize: row.fileSize,
  }
}
