import type { ComicDetail, ComicSummary } from '@shared/types'
import type { ComicRow } from '../db/repositories/comics'
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
