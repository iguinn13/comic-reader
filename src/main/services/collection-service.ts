import { randomUUID } from 'crypto'
import { AppError } from '@shared/errors'
import type {
  CollectionCoverInput,
  CollectionDetail,
  CollectionId,
  CollectionSummary,
  CollectionType,
  ComicId,
} from '@shared/types'
import type { Db } from '../db/client'
import {
  addItems,
  createCollection,
  deleteCollection,
  DuplicateCollectionNameError,
  getCollection,
  getCollectionIdsForComics,
  getNextUnreadOrFirst,
  listCollectionItems,
  listCollections,
  removeItems,
  reorder as reorderItems,
  ReorderMismatchError,
  setCollectionCover,
  updateCollection,
  type CollectionRow,
} from '../db/repositories/collections'
import { getComicDetail } from '../db/repositories/comics'
import { normalizeText } from '../utils/normalize'
import { toCollectionSummary } from './collection-dto'
import { toComicSummary } from './comic-dto'
import type { CoverService } from './cover-service'

export interface CreateCollectionInput {
  type: CollectionType
  name: string
  description?: string | null
  comicIds?: ComicId[]
}

export interface UpdateCollectionInput {
  name?: string
  description?: string | null
  type?: CollectionType
}

/**
 * CRUD e regras de negócio de listas/sagas (docs/02-arquitetura.md §3.1,
 * RF-20..26). A ordenação/renormalização de posições e a resolução de capa em
 * si já vivem no repositório (`db/repositories/collections.ts`); este serviço
 * valida existência, monta os DTOs (`CollectionSummary`/`CollectionDetail`,
 * com a URL `comic://` da capa já resolvida) e converte os erros de domínio
 * do repositório em `AppError`.
 */
export class CollectionService {
  constructor(
    private readonly db: Db,
    private readonly coverService: CoverService,
  ) {}

  list(type: CollectionType, sort: 'name' | 'updatedAt'): CollectionSummary[] {
    const rows = listCollections(this.db, type)
    const summaries = rows.map((row) => this.toSummary(row))
    if (sort === 'updatedAt') return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
    // `listCollections` já devolve em ordem de `name_normalized` (docs do repositório).
    return summaries
  }

  get(id: CollectionId): CollectionDetail {
    const row = this.requireCollection(id)
    return this.toDetail(row)
  }

  create(input: CreateCollectionInput): CollectionSummary {
    const id = randomUUID()
    const now = Date.now()

    try {
      createCollection(this.db, {
        id,
        type: input.type,
        name: input.name,
        nameNormalized: normalizeText(input.name),
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
    } catch (error) {
      this.throwAsAppError(error)
    }

    if (input.comicIds && input.comicIds.length > 0) {
      addItems(this.db, id, input.comicIds)
    }

    return this.toSummary(this.requireCollection(id))
  }

  update(id: CollectionId, patch: UpdateCollectionInput): CollectionSummary {
    this.requireCollection(id)

    try {
      const updated = updateCollection(this.db, id, {
        ...(patch.name !== undefined
          ? { name: patch.name, nameNormalized: normalizeText(patch.name) }
          : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
      })
      // `requireCollection` acima já garantiu que existe — `null` aqui não deveria acontecer.
      return this.toSummary(updated!)
    } catch (error) {
      this.throwAsAppError(error)
    }
  }

  delete(id: CollectionId): void {
    this.requireCollection(id)
    deleteCollection(this.db, id)
  }

  addItems(id: CollectionId, comicIds: ComicId[]): { added: number } {
    this.requireCollection(id)
    const before = listCollectionItems(this.db, id).length
    addItems(this.db, id, comicIds)
    const after = listCollectionItems(this.db, id).length
    return { added: after - before }
  }

  removeItems(id: CollectionId, comicIds: ComicId[]): void {
    this.requireCollection(id)
    removeItems(this.db, id, comicIds)
  }

  reorder(id: CollectionId, orderedComicIds: ComicId[]): void {
    this.requireCollection(id)
    try {
      reorderItems(this.db, id, orderedComicIds)
    } catch (error) {
      this.throwAsAppError(error)
    }
  }

  async setCover(id: CollectionId, cover: CollectionCoverInput): Promise<CollectionSummary> {
    const row = this.requireCollection(id)

    if (cover.mode === 'auto') {
      setCollectionCover(this.db, id, {
        coverMode: 'auto',
        coverComicId: null,
        coverVersion: row.coverVersion,
      })
    } else if (cover.mode === 'comic') {
      if (!getComicDetail(this.db, cover.comicId)) {
        throw new AppError('NOT_FOUND', 'errors.comicNotFound')
      }
      setCollectionCover(this.db, id, {
        coverMode: 'comic',
        coverComicId: cover.comicId,
        coverVersion: row.coverVersion,
      })
    } else {
      const result = await this.coverService.generateCollectionCover(
        id,
        cover.path,
        row.coverVersion,
      )
      if (!result) throw new AppError('IO', 'errors.io')
      setCollectionCover(this.db, id, {
        coverMode: 'image',
        coverComicId: null,
        coverVersion: result.coverVersion,
      })
    }

    return this.toSummary(this.requireCollection(id))
  }

  /** RF-19/RF-23: para o menu "Adicionar a…" — 'all' = todas as HQs selecionadas já estão na coleção, 'some' = só parte. */
  membership(comicIds: ComicId[]): Record<CollectionId, 'all' | 'some'> {
    const byComic = getCollectionIdsForComics(this.db, comicIds)
    const matchCount = new Map<CollectionId, number>()

    for (const comicId of comicIds) {
      const collectionIds = byComic.get(comicId)
      if (!collectionIds) continue
      for (const collectionId of collectionIds) {
        matchCount.set(collectionId, (matchCount.get(collectionId) ?? 0) + 1)
      }
    }

    const result: Record<CollectionId, 'all' | 'some'> = {}
    for (const [collectionId, count] of matchCount) {
      result[collectionId] = count === comicIds.length ? 'all' : 'some'
    }
    return result
  }

  /** RF-24: "Continuar saga" (primeira não lida) / "Ler novamente" (todas lidas → a primeira). */
  nextToRead(sagaId: CollectionId): ComicId | null {
    this.requireCollection(sagaId)
    return getNextUnreadOrFirst(this.db, sagaId)
  }

  private requireCollection(id: CollectionId): CollectionRow {
    const row = getCollection(this.db, id)
    if (!row) throw new AppError('NOT_FOUND', 'errors.collectionNotFound')
    return row
  }

  private toSummary(row: CollectionRow): CollectionSummary {
    return toCollectionSummary(this.db, row)
  }

  private toDetail(row: CollectionRow): CollectionDetail {
    const itemRows = listCollectionItems(this.db, row.id)
    const items = itemRows.map((item) => {
      const comicRow = getComicDetail(this.db, item.comicId)
      // Consistência garantida por FK `ON DELETE CASCADE` (docs/03 §2.5): um
      // item nunca aponta pra uma HQ que não existe mais.
      return { ...toComicSummary(comicRow!), position: item.position }
    })

    return {
      ...this.toSummary(row),
      coverComicId: row.coverComicId,
      items,
    }
  }

  /** Converte os erros de domínio do repositório em `AppError`; qualquer outro erro só propaga. */
  private throwAsAppError(error: unknown): never {
    if (error instanceof DuplicateCollectionNameError) {
      throw new AppError('CONFLICT', error.message)
    }
    if (error instanceof ReorderMismatchError) {
      throw new AppError('VALIDATION', error.message)
    }
    throw error
  }
}
