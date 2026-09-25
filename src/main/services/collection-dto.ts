import type { CollectionSummary } from '@shared/types'
import type { Db } from '../db/client'
import {
  getSagaProgress,
  resolveCoverUrl,
  type CollectionRow,
} from '../db/repositories/collections'
import { comicCoverUrl } from './comic-dto'

/** Resolve a capa da coleção (docs/03 §2.4) em URL `comic://`; `null` = placeholder. */
export function collectionCoverUrl(db: Db, collectionId: string): string | null {
  const resolution = resolveCoverUrl(db, collectionId)
  if (resolution.mode === 'empty') return null
  if (resolution.mode === 'image') {
    return `comic://cover/collection/${collectionId}?v=${resolution.coverVersion}`
  }
  return comicCoverUrl(resolution.comicId, resolution.coverVersion)
}

export function toCollectionSummary(db: Db, row: CollectionRow): CollectionSummary {
  const { total, read } = getSagaProgress(db, row.id)
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    coverUrl: collectionCoverUrl(db, row.id),
    coverMode: row.coverMode,
    itemCount: total,
    readCount: read,
    updatedAt: row.updatedAt,
  }
}
