import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Db, DbTransaction } from '../client'
import { collections, collectionItems, comics, readingProgress } from '../schema'

export type CollectionType = 'list' | 'saga'
export type CollectionCoverMode = 'auto' | 'image' | 'comic'

export interface CollectionRow {
  id: string
  type: CollectionType
  name: string
  nameNormalized: string
  description: string | null
  coverMode: CollectionCoverMode
  coverComicId: string | null
  coverVersion: number
  createdAt: number
  updatedAt: number
}

export interface CollectionItemRow {
  collectionId: string
  comicId: string
  position: number
  addedAt: number
}

/**
 * `UNIQUE(type, name_normalized)` é responsabilidade do SQLite (RF-20,
 * docs/03 §2.4): não checamos em JS antes de inserir, só convertemos o erro
 * do driver num erro reconhecível para o serviço tratar.
 */
export class DuplicateCollectionNameError extends Error {
  constructor(
    readonly type: CollectionType,
    readonly nameNormalized: string,
  ) {
    super('errors.collectionNameTaken')
    this.name = 'DuplicateCollectionNameError'
  }
}

/** `reorder` recebeu um conjunto de ids diferente dos itens atuais da coleção. */
export class ReorderMismatchError extends Error {
  constructor() {
    super('errors.collectionReorderMismatch')
    this.name = 'ReorderMismatchError'
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

export interface CreateCollectionInput {
  id: string
  type: CollectionType
  name: string
  /** Já normalizado por quem chama (docs/03 §1). */
  nameNormalized: string
  description?: string | null
  createdAt: number
  updatedAt: number
}

export function createCollection(db: Db, input: CreateCollectionInput): void {
  try {
    db.insert(collections)
      .values({
        id: input.id,
        type: input.type,
        name: input.name,
        nameNormalized: input.nameNormalized,
        description: input.description ?? null,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })
      .run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCollectionNameError(input.type, input.nameNormalized)
    }
    throw error
  }
}

export interface UpdateCollectionInput {
  name?: string
  /** Já normalizado por quem chama, obrigatório se `name` mudar. */
  nameNormalized?: string
  description?: string | null
  type?: CollectionType
}

/** `null` quando a coleção não existe. */
export function updateCollection(
  db: Db,
  id: string,
  patch: UpdateCollectionInput,
): CollectionRow | null {
  const current = getCollection(db, id)
  if (!current) return null

  try {
    db.update(collections)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.nameNormalized !== undefined ? { nameNormalized: patch.nameNormalized } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(collections.id, id))
      .run()
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCollectionNameError(
        patch.type ?? current.type,
        patch.nameNormalized ?? current.nameNormalized,
      )
    }
    throw error
  }

  return getCollection(db, id)
}

export interface SetCollectionCoverInput {
  coverMode: CollectionCoverMode
  /** `null` quando o modo não é `'comic'`. */
  coverComicId: string | null
  coverVersion: number
}

/** RF-25: grava o modo/capa escolhidos. Separado de `updateCollection` porque não mexe em nome/descrição/tipo. */
export function setCollectionCover(db: Db, id: string, input: SetCollectionCoverInput): void {
  db.update(collections)
    .set({
      coverMode: input.coverMode,
      coverComicId: input.coverComicId,
      coverVersion: input.coverVersion,
      updatedAt: Date.now(),
    })
    .where(eq(collections.id, id))
    .run()
}

/** Retorna quantas coleções foram apagadas. A cascata apaga só `collection_items`, nunca HQs. */
export function deleteCollection(db: Db, id: string): number {
  const result = db.delete(collections).where(eq(collections.id, id)).run()
  return result.changes
}

export function getCollection(db: Db, id: string): CollectionRow | null {
  const row = db.select().from(collections).where(eq(collections.id, id)).get()
  return row ?? null
}

export function listCollections(db: Db, type?: CollectionType): CollectionRow[] {
  const query = db.select().from(collections)
  const rows = type ? query.where(eq(collections.type, type)).all() : query.all()
  return [...rows].sort((a, b) => a.nameNormalized.localeCompare(b.nameNormalized))
}

/** Itens ordenados por posição (0-based, contínua dentro da coleção). */
export function listCollectionItems(db: Db, collectionId: string): CollectionItemRow[] {
  return db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(asc(collectionItems.position))
    .all()
}

/**
 * Adiciona HQs ao final da coleção, ignorando as que já estão presentes
 * (RF-23: sem repetição, `PK (collection_id, comic_id)`). Posições novas são
 * contínuas a partir do máximo atual.
 */
export function addItems(db: Db, collectionId: string, comicIds: string[]): void {
  db.transaction((tx) => {
    const existing = new Set(
      tx
        .select({ comicId: collectionItems.comicId })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, collectionId))
        .all()
        .map((r) => r.comicId),
    )

    const toAdd = [...new Set(comicIds)].filter((id) => !existing.has(id))
    if (toAdd.length === 0) return

    const maxPositionRow = tx
      .select({ max: sql<number | null>`max(${collectionItems.position})` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .get()
    const nextPosition = (maxPositionRow?.max ?? -1) + 1

    const now = Date.now()
    tx.insert(collectionItems)
      .values(
        toAdd.map((comicId, index) => ({
          collectionId,
          comicId,
          position: nextPosition + index,
          addedAt: now,
        })),
      )
      .run()

    tx.update(collections).set({ updatedAt: now }).where(eq(collections.id, collectionId)).run()
  })
}

/** Remove itens e renormaliza as posições restantes (0..n-1) na mesma transação (docs/03 §2.5). */
export function removeItems(db: Db, collectionId: string, comicIds: string[]): void {
  db.transaction((tx) => {
    tx.delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          inArray(collectionItems.comicId, comicIds),
        ),
      )
      .run()

    renormalizePositions(tx, collectionId)

    tx.update(collections)
      .set({ updatedAt: Date.now() })
      .where(eq(collections.id, collectionId))
      .run()
  })
}

/**
 * Aplica uma nova ordem explícita (posições 0..n-1). Rejeita quando
 * `orderedComicIds` não é uma permutação exata dos itens atuais da coleção.
 */
export function reorder(db: Db, collectionId: string, orderedComicIds: string[]): void {
  db.transaction((tx) => {
    const current = tx
      .select({ comicId: collectionItems.comicId })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .all()
      .map((r) => r.comicId)

    const isPermutation =
      current.length === orderedComicIds.length &&
      new Set(current).size === new Set(orderedComicIds).size &&
      current.every((id) => orderedComicIds.includes(id))

    if (!isPermutation) {
      throw new ReorderMismatchError()
    }

    orderedComicIds.forEach((comicId, index) => {
      tx.update(collectionItems)
        .set({ position: index })
        .where(
          and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.comicId, comicId)),
        )
        .run()
    })

    tx.update(collections)
      .set({ updatedAt: Date.now() })
      .where(eq(collections.id, collectionId))
      .run()
  })
}

/** Reindexa as posições restantes como 0..n-1, na ordem atual (docs/03 §2.5). */
function renormalizePositions(tx: DbTransaction, collectionId: string): void {
  const rows = tx
    .select({ comicId: collectionItems.comicId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(asc(collectionItems.position))
    .all()

  rows.forEach((row, index) => {
    tx.update(collectionItems)
      .set({ position: index })
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.comicId, row.comicId),
        ),
      )
      .run()
  })
}

export type CollectionCoverResolution =
  | { mode: 'image'; collectionId: string; coverVersion: number }
  | { mode: 'comic'; comicId: string; coverVersion: number }
  | { mode: 'empty' }

/**
 * Resolução da capa (docs/03 §2.4): devolve só os dados brutos (modo e o
 * `comic_id`/`collection_id` resolvido). Montar a URL `comic://...` é
 * responsabilidade de quem chama, fora do escopo desta tarefa.
 *
 * A checagem "cover_comic_id ainda na coleção" é feita a cada chamada
 * (membership dinâmica), então o fallback após remover a HQ da coleção
 * acontece automaticamente, sem precisar reescrever `cover_mode` no banco.
 */
export function resolveCoverUrl(db: Db, collectionId: string): CollectionCoverResolution {
  const collection = getCollection(db, collectionId)
  if (!collection) return { mode: 'empty' }

  if (collection.coverMode === 'image') {
    return { mode: 'image', collectionId: collection.id, coverVersion: collection.coverVersion }
  }

  if (collection.coverMode === 'comic' && collection.coverComicId) {
    const stillMember = db
      .select({ comicId: collectionItems.comicId })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.comicId, collection.coverComicId),
        ),
      )
      .get()

    if (stillMember) {
      const comic = getComicCoverVersion(db, collection.coverComicId)
      if (comic !== null) {
        return { mode: 'comic', comicId: collection.coverComicId, coverVersion: comic }
      }
    }
  }

  // 'auto', ou fallback de 'comic': capa da HQ de menor position; vazia = sem capa.
  const first = db
    .select({ comicId: collectionItems.comicId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(asc(collectionItems.position))
    .limit(1)
    .get()

  if (!first) return { mode: 'empty' }

  const coverVersion = getComicCoverVersion(db, first.comicId) ?? 0
  return { mode: 'comic', comicId: first.comicId, coverVersion }
}

function getComicCoverVersion(db: Db, comicId: string): number | null {
  const row = db
    .select({ coverVersion: comics.coverVersion })
    .from(comics)
    .where(eq(comics.id, comicId))
    .get()
  return row?.coverVersion ?? null
}

/** RF-24: progresso x/y da saga (docs/03 §5). */
export function getSagaProgress(db: Db, collectionId: string): { total: number; read: number } {
  const row = db
    .select({
      total: sql<number>`count(*)`,
      read: sql<number>`coalesce(sum(${readingProgress.completedAt} is not null), 0)`,
    })
    .from(collectionItems)
    .innerJoin(readingProgress, eq(readingProgress.comicId, collectionItems.comicId))
    .where(eq(collectionItems.collectionId, collectionId))
    .get()

  return { total: row?.total ?? 0, read: row?.read ?? 0 }
}

/** `ComicDetail.collections` (docs/04 §2): a que coleções esta HQ pertence, para exibir no card/detalhe. */
export function getCollectionsForComic(
  db: Db,
  comicId: string,
): { id: string; type: CollectionType; name: string }[] {
  return db
    .select({ id: collections.id, type: collections.type, name: collections.name })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(eq(collectionItems.comicId, comicId))
    .orderBy(asc(collections.nameNormalized))
    .all()
}

/** RF-19/RF-23: para cada `comicId`, em quais coleções ele está — usado pelo menu "Adicionar a…". */
export function getCollectionIdsForComics(db: Db, comicIds: string[]): Map<string, Set<string>> {
  const rows = db
    .select({ collectionId: collectionItems.collectionId, comicId: collectionItems.comicId })
    .from(collectionItems)
    .where(inArray(collectionItems.comicId, comicIds))
    .all()

  const byComic = new Map<string, Set<string>>()
  for (const row of rows) {
    const set = byComic.get(row.comicId) ?? new Set<string>()
    set.add(row.collectionId)
    byComic.set(row.comicId, set)
  }
  return byComic
}

/** RF-24 ("Continuar saga"/"Ler novamente"): primeira não lida na ordem; se todas lidas, a primeira. */
export function getNextUnreadOrFirst(db: Db, sagaId: string): string | null {
  const items = db
    .select({ comicId: collectionItems.comicId, completedAt: readingProgress.completedAt })
    .from(collectionItems)
    .innerJoin(readingProgress, eq(readingProgress.comicId, collectionItems.comicId))
    .where(eq(collectionItems.collectionId, sagaId))
    .orderBy(asc(collectionItems.position))
    .all()

  if (items.length === 0) return null
  const firstUnread = items.find((item) => item.completedAt === null)
  return (firstUnread ?? items[0]).comicId
}

/** RF-42: próxima HQ da saga após `comicId`, ou `null` se for a última (ou não pertencer à saga). */
export function getNextToRead(db: Db, sagaId: string, comicId: string): string | null {
  const current = db
    .select({ position: collectionItems.position })
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, sagaId), eq(collectionItems.comicId, comicId)))
    .get()

  if (!current) return null

  const next = db
    .select({ comicId: collectionItems.comicId })
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, sagaId),
        eq(collectionItems.position, current.position + 1),
      ),
    )
    .get()

  return next?.comicId ?? null
}

/** RF-42: sagas que contêm a HQ, com a posição dela (0-based) e o total de itens. */
export function getSagasContainingComic(
  db: Db,
  comicId: string,
): { id: string; name: string; position: number; total: number }[] {
  const rows = db
    .select({ id: collections.id, name: collections.name, position: collectionItems.position })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(and(eq(collectionItems.comicId, comicId), eq(collections.type, 'saga')))
    .orderBy(asc(collections.nameNormalized))
    .all()

  return rows.map((row) => ({ ...row, total: getSagaProgress(db, row.id).total }))
}

/** RF-63: sagas com pelo menos 1 HQ lida e 1 não lida, mais recentemente atualizadas primeiro. */
export function listSagasInProgress(db: Db, limit: number): CollectionRow[] {
  return listCollections(db, 'saga')
    .filter((saga) => {
      const { total, read } = getSagaProgress(db, saga.id)
      return read > 0 && read < total
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}
