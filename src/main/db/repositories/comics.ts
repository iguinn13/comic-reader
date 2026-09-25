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
  /** Caminho absoluto do arquivo original — nunca exposto ao renderer (docs/10 ADR). */
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
  /** Caminho absoluto do arquivo original — lido in-place, nunca copiado (docs/10 ADR). */
  filePath: string
  /** Pasta-pai de `filePath`. */
  dirPath: string
  /** Pasta-raiz (docs/05-importacao.md) sob a qual o arquivo foi encontrado. */
  folderId: string
  originalFileName: string
  fileSize: number
  fileHash: string
  pageCount: number
  createdAt: number
  updatedAt: number
  /** Vazio para PDF: o pdf.js fornece as páginas (docs/03 §2.2). */
  pages: InsertComicPageInput[]
  /** 0 (default da coluna) quando a capa ainda não foi gerada (docs/03 §2.1). */
  coverVersion?: number
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

/**
 * Insere a HQ, as páginas (zip/rar) e a linha inicial de progresso numa
 * única transação — passo final do scan de pastas (docs/05-importacao.md
 * §4). Quem chama (`LibraryScanService`) já resolveu `id`, hash, contagem de
 * páginas etc.
 */
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

/** Retorna quantas HQs foram apagadas (RF-17). Cascata apaga páginas e progresso; nunca o arquivo original. */
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

/** Todos os ids existentes, usados pelo `MaintenanceService` para achar órfãos em disco (RNF-05). */
export function listComicIds(db: Db): string[] {
  return db
    .select({ id: comics.id })
    .from(comics)
    .all()
    .map((row) => row.id)
}

/** Só o essencial pra resolver o arquivo/páginas de uma HQ (`PageCacheService`, `comic://file`). */
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

/** Para achar o "próximo arquivo da pasta" no fim da leitura (RF-42, ordenado com `naturalSort`). */
export function listComicsInDir(db: Db, dirPath: string): Array<{ id: string; filePath: string }> {
  return db
    .select({ id: comics.id, filePath: comics.filePath })
    .from(comics)
    .where(eq(comics.dirPath, dirPath))
    .all()
}

/** Para checar se um caminho já está indexado durante o scan (docs/05). */
export function getComicByFilePath(db: Db, filePath: string): { id: string } | null {
  const row = db.select({ id: comics.id }).from(comics).where(eq(comics.filePath, filePath)).get()
  return row ?? null
}

/** Todas as HQs de uma pasta-raiz, para o rescan detectar arquivos que sumiram (docs/05). */
export function listComicsInFolder(
  db: Db,
  folderId: string,
): Array<{ id: string; filePath: string }> {
  return db
    .select({ id: comics.id, filePath: comics.filePath })
    .from(comics)
    .where(eq(comics.folderId, folderId))
    .all()
}

/**
 * Todas as HQs (linha completa) de uma pasta-raiz, para a navegação por
 * pastas (RF-64): quem chama agrupa por `filePath` relativo à pasta-raiz em
 * JS (main tem `path.relative`), em vez de tentar isso em SQL.
 */
export function listComicRowsInFolder(db: Db, folderId: string): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(eq(comics.folderId, folderId))
    .all()
}

/** RF-52: quantidade de HQs e soma do tamanho dos arquivos na biblioteca. */
export function getLibraryTotals(db: Db): { comicCount: number; libraryBytes: number } {
  const row = db
    .select({
      comicCount: sql<number>`count(*)`,
      libraryBytes: sql<number>`coalesce(sum(${comics.fileSize}), 0)`,
    })
    .from(comics)
    .get()
  return { comicCount: row?.comicCount ?? 0, libraryBytes: row?.libraryBytes ?? 0 }
}
