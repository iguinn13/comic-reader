import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { ReaderPrefs } from '@shared/types'
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
export function getProgress(db: Db, comicId: string): ProgressRow | null {
  const row = db.select().from(readingProgress).where(eq(readingProgress.comicId, comicId)).get()
  return row ?? null
}
export function setCurrentPage(db: Db, comicId: string, page: number): void {
  db.update(readingProgress)
    .set({
      currentPage: page,
      lastReadAt: Date.now(),
      completedAt: sql`CASE WHEN ${readingProgress.currentPage} <> ${page} THEN NULL ELSE ${readingProgress.completedAt} END`,
    })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
export function markRead(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: Date.now() })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
export function markReadAndRewind(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: Date.now(), currentPage: 0 })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
export function markUnread(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: null, currentPage: 0, lastReadAt: null })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
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
export function getRecentlyAdded(db: Db, limit: number): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .orderBy(desc(comics.createdAt), asc(comics.id))
    .limit(limit)
    .all()
}
export function resetAllReaderPrefs(db: Db): void {
  db.update(readingProgress).set({ readerPrefs: null }).run()
}
export function getReaderPrefs(db: Db, comicId: string): ReaderPrefs | null {
  const row = db
    .select({ readerPrefs: readingProgress.readerPrefs })
    .from(readingProgress)
    .where(eq(readingProgress.comicId, comicId))
    .get()
  return row?.readerPrefs ? (JSON.parse(row.readerPrefs) as ReaderPrefs) : null
}
export function setReaderPrefs(db: Db, comicId: string, prefs: ReaderPrefs): void {
  db.update(readingProgress)
    .set({ readerPrefs: JSON.stringify(prefs) })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
export function resetReaderPrefs(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ readerPrefs: null })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
