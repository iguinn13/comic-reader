import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../client'
import { collectionItems, collections as collectionsTable } from '../schema'
import { deleteComics, insertComic, type InsertComicInput } from './comics'
import { markRead } from './progress'
import {
  addItems,
  createCollection,
  deleteCollection,
  DuplicateCollectionNameError,
  getCollection,
  getNextToRead,
  getSagaProgress,
  listCollectionItems,
  removeItems,
  reorder,
  ReorderMismatchError,
  resolveCoverUrl,
  updateCollection,
  type CreateCollectionInput,
} from './collections'

let db: Db

function makeComic(overrides: Partial<InsertComicInput> = {}): InsertComicInput {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    title: 'HQ',
    titleNormalized: 'hq',
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: 'hq.cbz',
    fileSize: 10,
    fileHash: `hash-${id}`,
    pageCount: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
    ...overrides,
  }
}

function makeCollection(overrides: Partial<CreateCollectionInput> = {}): CreateCollectionInput {
  const now = Date.now()
  return {
    id: randomUUID(),
    type: 'list',
    name: 'Minha Lista',
    nameNormalized: 'minha lista',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function addComic(overrides: Partial<InsertComicInput> = {}): string {
  const comic = makeComic(overrides)
  insertComic(db, comic)
  return comic.id
}

/**
 * Ajusta `cover_mode`/`cover_comic_id` direto no schema. Não há setter
 * dedicado nesta tarefa (isso é RF-25/CollectionService, M5); o teste só
 * precisa colocar a coleção num estado válido para exercitar `resolveCoverUrl`.
 */
function setCoverMode(
  db: Db,
  id: string,
  mode: 'auto' | 'image' | 'comic',
  comicId: string | null = null,
): void {
  db.update(collectionsTable)
    .set({ coverMode: mode, coverComicId: comicId })
    .where(eq(collectionsTable.id, id))
    .run()
}

beforeEach(() => {
  db = createDb(':memory:')
})

describe('createCollection', () => {
  it('rejeita nome duplicado no mesmo tipo (UNIQUE(type, name_normalized))', () => {
    createCollection(db, makeCollection({ type: 'list', nameNormalized: 'vingadores' }))

    expect(() =>
      createCollection(db, makeCollection({ type: 'list', nameNormalized: 'vingadores' })),
    ).toThrow(DuplicateCollectionNameError)
  })

  it('permite o mesmo nome normalizado em tipos diferentes (list vs saga)', () => {
    createCollection(db, makeCollection({ type: 'list', nameNormalized: 'vingadores' }))

    expect(() =>
      createCollection(db, makeCollection({ type: 'saga', nameNormalized: 'vingadores' })),
    ).not.toThrow()
  })
})

describe('updateCollection', () => {
  it('rejeita renomear para um nome já usado no mesmo tipo', () => {
    createCollection(db, makeCollection({ type: 'list', nameNormalized: 'a' }))
    const other = makeCollection({ type: 'list', nameNormalized: 'b' })
    createCollection(db, other)

    expect(() => updateCollection(db, other.id, { name: 'A', nameNormalized: 'a' })).toThrow(
      DuplicateCollectionNameError,
    )
  })

  it('devolve null quando a coleção não existe', () => {
    expect(updateCollection(db, randomUUID(), { name: 'X' })).toBeNull()
  })
})

describe('deleteCollection', () => {
  it('apaga a coleção sem apagar as HQs', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const comicId = addComic()
    addItems(db, collection.id, [comicId])

    const deleted = deleteCollection(db, collection.id)

    expect(deleted).toBe(1)
    expect(getCollection(db, collection.id)).toBeNull()
    // Item da coleção some (cascade), mas a HQ em si continua existindo.
    expect(db.select().from(collectionItems).all()).toEqual([])
  })
})

describe('addItems', () => {
  it('adiciona sem duplicar a mesma HQ na coleção', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const comicId = addComic()

    addItems(db, collection.id, [comicId])
    addItems(db, collection.id, [comicId]) // segunda chamada não deve duplicar

    const items = listCollectionItems(db, collection.id)
    expect(items).toHaveLength(1)
    expect(items[0]?.comicId).toBe(comicId)
  })

  it('atribui posições contínuas a partir do máximo atual', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    const c = addComic()

    addItems(db, collection.id, [a])
    addItems(db, collection.id, [b, c])

    const items = listCollectionItems(db, collection.id)
    expect(items.map((i) => i.position)).toEqual([0, 1, 2])
  })
})

describe('removeItems', () => {
  it('remove e renormaliza as posições restantes (0..n-1)', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    const c = addComic()
    addItems(db, collection.id, [a, b, c])

    removeItems(db, collection.id, [b])

    const items = listCollectionItems(db, collection.id)
    expect(items.map((i) => i.comicId)).toEqual([a, c])
    expect(items.map((i) => i.position)).toEqual([0, 1])
  })
})

describe('reorder', () => {
  it('aplica a nova ordem como posições 0..n-1', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    const c = addComic()
    addItems(db, collection.id, [a, b, c])

    reorder(db, collection.id, [c, a, b])

    const items = listCollectionItems(db, collection.id)
    expect(items.map((i) => i.comicId)).toEqual([c, a, b])
    expect(items.map((i) => i.position)).toEqual([0, 1, 2])
  })

  it('rejeita quando os ids não são uma permutação exata dos itens atuais', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    addItems(db, collection.id, [a, b])

    expect(() => reorder(db, collection.id, [a])).toThrow(ReorderMismatchError)
    expect(() => reorder(db, collection.id, [a, b, randomUUID()])).toThrow(ReorderMismatchError)
  })
})

describe('resolveCoverUrl', () => {
  it('coleção sem cover_mode configurado (default "auto") e vazia => sem capa', () => {
    const collection = makeCollection()
    createCollection(db, collection)

    expect(resolveCoverUrl(db, collection.id)).toEqual({ mode: 'empty' })
  })

  it('modo image: aponta para a capa própria da coleção, mesmo com itens', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    addItems(db, collection.id, [a])
    setCoverMode(db, collection.id, 'image')

    expect(resolveCoverUrl(db, collection.id)).toEqual({
      mode: 'image',
      collectionId: collection.id,
      coverVersion: 0,
    })
  })

  it('modo auto: capa da HQ de menor position; vazia quando a coleção está vazia', () => {
    const collection = makeCollection()
    createCollection(db, collection)

    expect(resolveCoverUrl(db, collection.id)).toEqual({ mode: 'empty' })

    const a = addComic()
    const b = addComic()
    addItems(db, collection.id, [a, b])

    expect(resolveCoverUrl(db, collection.id)).toEqual({
      mode: 'comic',
      comicId: a,
      coverVersion: 0,
    })
  })

  it('modo comic: usa a HQ configurada enquanto ela estiver na coleção, com fallback ao ser removida', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    addItems(db, collection.id, [a, b])
    setCoverMode(db, collection.id, 'comic', b)

    expect(resolveCoverUrl(db, collection.id)).toEqual({
      mode: 'comic',
      comicId: b,
      coverVersion: 0,
    })

    // Ao sair da coleção, cai no fallback (menor position = a).
    removeItems(db, collection.id, [b])
    expect(resolveCoverUrl(db, collection.id)).toEqual({
      mode: 'comic',
      comicId: a,
      coverVersion: 0,
    })
  })
})

describe('getSagaProgress', () => {
  it('conta o total e quantas HQs já foram lidas', () => {
    const saga = makeCollection({ type: 'saga', nameNormalized: 'saga x' })
    createCollection(db, saga)
    const a = addComic()
    const b = addComic()
    const c = addComic()
    addItems(db, saga.id, [a, b, c])
    markRead(db, a)
    markRead(db, b)

    expect(getSagaProgress(db, saga.id)).toEqual({ total: 3, read: 2 })
  })

  it('devolve 0/0 para uma saga vazia', () => {
    const saga = makeCollection({ type: 'saga', nameNormalized: 'vazia' })
    createCollection(db, saga)

    expect(getSagaProgress(db, saga.id)).toEqual({ total: 0, read: 0 })
  })
})

describe('getNextToRead', () => {
  it('devolve a próxima HQ da saga pela posição', () => {
    const saga = makeCollection({ type: 'saga', nameNormalized: 'saga y' })
    createCollection(db, saga)
    const a = addComic()
    const b = addComic()
    const c = addComic()
    addItems(db, saga.id, [a, b, c])

    expect(getNextToRead(db, saga.id, a)).toBe(b)
    expect(getNextToRead(db, saga.id, b)).toBe(c)
  })

  it('devolve null quando é a última ou a HQ não pertence à saga', () => {
    const saga = makeCollection({ type: 'saga', nameNormalized: 'saga z' })
    createCollection(db, saga)
    const a = addComic()
    const b = addComic()
    addItems(db, saga.id, [a, b])

    expect(getNextToRead(db, saga.id, b)).toBeNull()
    expect(getNextToRead(db, saga.id, randomUUID())).toBeNull()
  })
})

describe('exclusão de HQ atualizando as coleções', () => {
  it('remove a HQ apagada dos itens da coleção (cascade) sem apagar a coleção', () => {
    const collection = makeCollection()
    createCollection(db, collection)
    const a = addComic()
    const b = addComic()
    addItems(db, collection.id, [a, b])

    deleteComics(db, [a])

    const items = listCollectionItems(db, collection.id)
    expect(items.map((i) => i.comicId)).toEqual([b])
    expect(getCollection(db, collection.id)).not.toBeNull()
  })
})
