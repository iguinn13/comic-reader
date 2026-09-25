import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../client'
import { comicPages } from '../schema'

export interface ComicPageRow {
  pageIndex: number
  entryName: string
  width: number | null
  height: number | null
}

/** Todas as páginas de uma HQ CBZ/CBR, em ordem (docs/03 §2.2). Vazio para PDF. */
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

/** `null` se a página não existe (índice fora do intervalo). */
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

/**
 * Grava as dimensões medidas durante a extração (docs/06-leitor.md §7: "mede
 * a página com image-size e grava width/height em comic_pages em lote").
 */
export function updatePageDimensions(
  db: Db,
  comicId: string,
  updates: { pageIndex: number; width: number; height: number }[],
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
