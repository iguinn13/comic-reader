import { and, asc, desc, eq, inArray, like, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../client'
import { comics, comicPages, readingProgress } from '../schema'

/** Status derivado (RF-14, docs/03-modelo-de-dados.md §2.3). */
export type ComicStatus = 'unread' | 'reading' | 'read'

export interface ComicRow {
  id: string
  title: string
  titleNormalized: string
  format: 'zip' | 'rar' | 'pdf'
  fileName: string
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

/** Página a inserir junto da HQ (docs/03 §2.2). Ausente para PDF. */
export interface InsertComicPageInput {
  pageIndex: number
  entryName: string
  width?: number | null
  height?: number | null
}

export interface InsertComicInput {
  id: string
  title: string
  /** Já normalizado (minúsculas, sem acento) por quem chama — docs/03 §1. */
  titleNormalized: string
  format: 'zip' | 'rar' | 'pdf'
  fileName: string
  originalFileName: string
  fileSize: number
  fileHash: string
  pageCount: number
  createdAt: number
  updatedAt: number
  /** Vazio para PDF: o pdf.js fornece as páginas (docs/03 §2.2). */
  pages: InsertComicPageInput[]
}

/** Expressão SQL do status derivado, reaproveitada em SELECT e WHERE. */
const statusExpr = sql<ComicStatus>`CASE
  WHEN ${readingProgress.completedAt} IS NOT NULL THEN 'read'
  WHEN ${readingProgress.currentPage} > 0 THEN 'reading'
  ELSE 'unread'
END`

/** Reaproveitada por outros repositórios (ex.: progress.ts) que devolvem HQs completas. */
export const comicColumns = {
  id: comics.id,
  title: comics.title,
  titleNormalized: comics.titleNormalized,
  format: comics.format,
  fileName: comics.fileName,
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

/**
 * Insere a HQ, as páginas (zip/rar) e a linha inicial de progresso numa
 * única transação — passo 8 do pipeline de importação (docs/05-importacao.md
 * §4). Quem chama (ImportService, fora do escopo desta tarefa) já resolveu
 * `id`, hash, contagem de páginas etc.
 */
export function insertComic(db: Db, input: InsertComicInput): void {
  db.transaction((tx) => {
    tx.insert(comics)
      .values({
        id: input.id,
        title: input.title,
        titleNormalized: input.titleNormalized,
        format: input.format,
        fileName: input.fileName,
        originalFileName: input.originalFileName,
        fileSize: input.fileSize,
        fileHash: input.fileHash,
        pageCount: input.pageCount,
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

/** `null` quando a HQ não existe. */
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
  /** Já normalizado por quem chama (docs/03 §1); vazio/ausente = sem filtro. */
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

/** Biblioteca com busca, filtros, ordenação e paginação (docs/03 §5, RF-10/12/13). */
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

  // Desempate estável por id em todas as ordenações (docs/03 §5, docs/09 §2.1).
  if (query.sort === 'title') {
    return [dir(comics.titleNormalized), asc(comics.id)]
  }
  if (query.sort === 'createdAt') {
    return [dir(comics.createdAt), asc(comics.id)]
  }
  // lastReadAt: nulos sempre por último, independente da direção (docs/03 §5).
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

/** Retorna quantas HQs foram apagadas (RF-17). Cascata apaga páginas, progresso e itens de coleção. */
export function deleteComics(db: Db, ids: string[]): number {
  if (ids.length === 0) return 0
  const result = db.delete(comics).where(inArray(comics.id, ids)).run()
  return result.changes
}

/** Para checar duplicata na importação (docs/05 §4 passo 5). */
export function getComicsByHash(db: Db, hash: string): Array<{ id: string; title: string }> {
  return db
    .select({ id: comics.id, title: comics.title })
    .from(comics)
    .where(eq(comics.fileHash, hash))
    .all()
}
