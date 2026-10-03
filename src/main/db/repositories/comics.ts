import { and, asc, desc, eq, inArray, like, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../client'
import { comics, comicPages, readingProgress } from '../schema'
export type ComicStatus = 'unread' | 'reading' | 'read'
export interface ComicRow {
  id: string
  title: string
  titleNormalized: string
  format: 'zip' | 'rar' | 'pdf'
  filePath: string
  dirPath: string
  originalFileName: string
  fileSize: number
  fileHash: string
  pageCount: number
  coverVersion: number
  isFavorite: boolean
  createdAt: number
  updatedAt: number
  currentPage: number
  lastReadAt: number | null
  completedAt: number | null
  status: ComicStatus
}
export interface InsertComicPageInput {
  pageIndex: number
  entryName: string
  width?: number | null
  height?: number | null
}
export interface InsertComicInput {
  id: string
  title: string
  titleNormalized: string
  format: 'zip' | 'rar' | 'pdf'
  filePath: string
  dirPath: string
  folderId: string
  originalFileName: string
  fileSize: number
  fileHash: string
  pageCount: number
  createdAt: number
  updatedAt: number
  pages: InsertComicPageInput[]
  coverVersion?: number
}
const statusExpr = sql<ComicStatus>`CASE
  WHEN ${readingProgress.completedAt} IS NOT NULL THEN 'read'
  WHEN ${readingProgress.currentPage} > 0 THEN 'reading'
  ELSE 'unread'
END`
export const comicColumns = {
  id: comics.id,
  title: comics.title,
  titleNormalized: comics.titleNormalized,
  format: comics.format,
  filePath: comics.filePath,
  dirPath: comics.dirPath,
  originalFileName: comics.originalFileName,
  fileSize: comics.fileSize,
  fileHash: comics.fileHash,
  pageCount: comics.pageCount,
  coverVersion: comics.coverVersion,
  isFavorite: comics.isFavorite,
  createdAt: comics.createdAt,
  updatedAt: comics.updatedAt,
  currentPage: readingProgress.currentPage,
  lastReadAt: readingProgress.lastReadAt,
  completedAt: readingProgress.completedAt,
  status: statusExpr,
}
export function insertComic(db: Db, input: InsertComicInput): void {
  db.transaction((tx) => {
    tx.insert(comics)
      .values({
        id: input.id,
        title: input.title,
        titleNormalized: input.titleNormalized,
        format: input.format,
        filePath: input.filePath,
        dirPath: input.dirPath,
        folderId: input.folderId,
        originalFileName: input.originalFileName,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        pageCount: input.pageCount,
        coverVersion: input.coverVersion ?? 0,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })
      .run()
    if (input.pages.length > 0) {
      tx.insert(comicPages)
        .values(
          input.pages.map((page) => ({
            comicId: input.id,
            pageIndex: page.pageIndex,
            entryName: page.entryName,
            width: page.width ?? null,
            height: page.height ?? null,
          })),
        )
        .run()
    }
    tx.insert(readingProgress)
      .values({
        comicId: input.id,
        currentPage: 0,
        lastReadAt: null,
        completedAt: null,
        readerPrefs: null,
      })
      .run()
  })
}
export function getComicDetail(db: Db, id: string): ComicRow | null {
  const row = db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(eq(comics.id, id))
    .get()
  return row ?? null
}
export interface ListComicsQuery {
  searchNormalized?: string
  sort: 'title' | 'createdAt' | 'lastReadAt'
  order: 'asc' | 'desc'
  status: 'all' | ComicStatus
  favoritesOnly: boolean
  limit: number
  offset: number
}
export interface ListComicsResult {
  items: ComicRow[]
  total: number
}
export function listComics(db: Db, query: ListComicsQuery): ListComicsResult {
  const where = buildListComicsWhere(query)
  const orderBy = buildListComicsOrderBy(query)
  const items = db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(query.limit)
    .offset(query.offset)
    .all()
  const totalRow = db
    .select({ total: sql<number>`count(*)` })
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(where)
    .get()
  return { items, total: totalRow?.total ?? 0 }
}
function buildListComicsWhere(query: ListComicsQuery): SQL | undefined {
  const conditions: SQL[] = []
  if (query.searchNormalized) {
    conditions.push(like(comics.titleNormalized, `%${query.searchNormalized}%`))
  }
  if (query.favoritesOnly) {
    conditions.push(eq(comics.isFavorite, true))
  }
  if (query.status === 'read') {
    conditions.push(sql`${readingProgress.completedAt} IS NOT NULL`)
  } else if (query.status === 'reading') {
    conditions.push(
      sql`${readingProgress.completedAt} IS NULL AND ${readingProgress.currentPage} > 0`,
    )
  } else if (query.status === 'unread') {
    conditions.push(
      sql`${readingProgress.completedAt} IS NULL AND ${readingProgress.currentPage} = 0`,
    )
  }
  return conditions.length > 0 ? and(...conditions) : undefined
}
function buildListComicsOrderBy(query: ListComicsQuery): SQL[] {
  const dir = query.order === 'asc' ? asc : desc
  if (query.sort === 'title') {
    return [dir(comics.titleNormalized), asc(comics.id)]
  }
  if (query.sort === 'createdAt') {
    return [dir(comics.createdAt), asc(comics.id)]
  }
  return [
    sql`${readingProgress.lastReadAt} IS NULL`,
    dir(readingProgress.lastReadAt),
    asc(comics.id),
  ]
}
export function renameComic(db: Db, id: string, title: string, titleNormalized: string): void {
  db.update(comics)
    .set({ title, titleNormalized, updatedAt: Date.now() })
    .where(eq(comics.id, id))
    .run()
}
export function setFavorite(db: Db, id: string, isFavorite: boolean): void {
  db.update(comics).set({ isFavorite, updatedAt: Date.now() }).where(eq(comics.id, id)).run()
}
export function deleteComics(db: Db, ids: string[]): number {
  if (ids.length === 0) return 0
  const result = db.delete(comics).where(inArray(comics.id, ids)).run()
  return result.changes
}
export function getComicsByHash(
  db: Db,
  hash: string,
): Array<{
  id: string
  title: string
}> {
  return db
    .select({ id: comics.id, title: comics.title })
    .from(comics)
    .where(eq(comics.fileHash, hash))
    .all()
}
export function listComicIds(db: Db): string[] {
  return db
    .select({ id: comics.id })
    .from(comics)
    .all()
    .map((row) => row.id)
}
export function getComicFileMeta(
  db: Db,
  id: string,
): {
  format: 'zip' | 'rar' | 'pdf'
  pageCount: number
  filePath: string
  dirPath: string
  folderId: string
} | null {
  const row = db
    .select({
      format: comics.format,
      pageCount: comics.pageCount,
      filePath: comics.filePath,
      dirPath: comics.dirPath,
      folderId: comics.folderId,
    })
    .from(comics)
    .where(eq(comics.id, id))
    .get()
  return row ?? null
}
export function listComicsInDir(
  db: Db,
  dirPath: string,
): Array<{
  id: string
  filePath: string
}> {
  return db
    .select({ id: comics.id, filePath: comics.filePath })
    .from(comics)
    .where(eq(comics.dirPath, dirPath))
    .all()
}
export function getComicByFilePath(
  db: Db,
  filePath: string,
): {
  id: string
} | null {
  const row = db.select({ id: comics.id }).from(comics).where(eq(comics.filePath, filePath)).get()
  return row ?? null
}
export function listComicsInFolder(
  db: Db,
  folderId: string,
): Array<{
  id: string
  filePath: string
}> {
  return db
    .select({ id: comics.id, filePath: comics.filePath })
    .from(comics)
    .where(eq(comics.folderId, folderId))
    .all()
}
export function listComicRowsInFolder(db: Db, folderId: string): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(eq(comics.folderId, folderId))
    .all()
}
export function getLibraryTotals(db: Db): {
  comicCount: number
  libraryBytes: number
} {
  const row = db
    .select({
      comicCount: sql<number>`count(*)`,
      libraryBytes: sql<number>`coalesce(sum(${comics.fileSize}), 0)`,
    })
    .from(comics)
    .get()
  return { comicCount: row?.comicCount ?? 0, libraryBytes: row?.libraryBytes ?? 0 }
}
