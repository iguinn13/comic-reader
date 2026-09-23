import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import type { Db } from '../client'
import { comics, readingProgress } from '../schema'
import { comicColumns, type ComicRow } from './comics'

export interface ProgressRow {
  comicId: string
  currentPage: number
  lastReadAt: number | null
  completedAt: number | null
  readerPrefs: string | null
}

/** `null` quando a HQ não existe (não deveria acontecer: toda HQ tem progresso desde a importação). */
export function getProgress(db: Db, comicId: string): ProgressRow | null {
  const row = db.select().from(readingProgress).where(eq(readingProgress.comicId, comicId)).get()

  return row ?? null
}

/**
 * Avança/retrocede a página atual. Não mexe em `completed_at`: reabrir uma
 * HQ lida e navegar não remove a marca de lida (docs/03 §2.3).
 */
export function setCurrentPage(db: Db, comicId: string, page: number): void {
  db.update(readingProgress)
    .set({ currentPage: page, lastReadAt: Date.now() })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** `current_page` é mantido: reabrir continua de onde estava (docs/03 §2.3). */
export function markRead(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: Date.now() })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** Zera o progresso por completo (docs/03 §2.3). */
export function markUnread(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: null, currentPage: 0, lastReadAt: null })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** RF-11: em andamento, mais recentes primeiro (docs/03 §5). */
export function getContinueReading(db: Db, limit: number): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(and(isNull(readingProgress.completedAt), gt(readingProgress.currentPage, 0)))
    .orderBy(desc(readingProgress.lastReadAt))
    .limit(limit)
    .all()
}

/** RF-63: últimas HQs adicionadas, mais recentes primeiro. */
export function getRecentlyAdded(db: Db, limit: number): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .orderBy(desc(comics.createdAt), asc(comics.id))
    .limit(limit)
    .all()
}

/** RF-50 "Aplicar a todas as HQs": limpa as preferências de leitura salvas por HQ. */
export function resetAllReaderPrefs(db: Db): void {
  db.update(readingProgress).set({ readerPrefs: null }).run()
}
