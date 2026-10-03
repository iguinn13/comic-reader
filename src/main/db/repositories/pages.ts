import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../client'
import { comicPages } from '../schema'
export interface ComicPageRow {
  pageIndex: number
  entryName: string
  width: number | null
  height: number | null
}
export function listComicPages(db: Db, comicId: string): ComicPageRow[] {
  return db
    .select({
      pageIndex: comicPages.pageIndex,
      entryName: comicPages.entryName,
      width: comicPages.width,
      height: comicPages.height,
    })
    .from(comicPages)
    .where(eq(comicPages.comicId, comicId))
    .orderBy(asc(comicPages.pageIndex))
    .all()
}
export function getComicPage(db: Db, comicId: string, pageIndex: number): ComicPageRow | null {
  const row = db
    .select({
      pageIndex: comicPages.pageIndex,
      entryName: comicPages.entryName,
      width: comicPages.width,
      height: comicPages.height,
    })
    .from(comicPages)
    .where(and(eq(comicPages.comicId, comicId), eq(comicPages.pageIndex, pageIndex)))
    .get()
  return row ?? null
}
export function updatePageDimensions(
  db: Db,
  comicId: string,
  updates: {
    pageIndex: number
    width: number
    height: number
  }[],
): void {
  if (updates.length === 0) return
  db.transaction((tx) => {
    for (const update of updates) {
      tx.update(comicPages)
        .set({ width: update.width, height: update.height })
        .where(and(eq(comicPages.comicId, comicId), eq(comicPages.pageIndex, update.pageIndex)))
        .run()
    }
  })
}
