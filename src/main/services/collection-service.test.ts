import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import { createDb, type Db } from '../db/client'
import { insertComic, type InsertComicInput } from '../db/repositories/comics'
import { markRead } from '../db/repositories/progress'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { CollectionService } from './collection-service'
import { CoverService } from './cover-service'

let db: Db
let root: string
let paths: AppPaths
let service: CollectionService

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

function addComic(overrides: Partial<InsertComicInput> = {}): string {
  const comic = makeComic(overrides)
  insertComic(db, comic)
  return comic.id
}

beforeEach(() => {
  db = createDb(':memory:')
  root = mkdtempSync(join(tmpdir(), 'comic-reader-collections-'))
  paths = createAppPaths(root)
  const coverService = new CoverService(paths, (buf) => buf)
  service = new CollectionService(db, coverService)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('CollectionService.create/get/update/delete', () => {
  it('cria uma coleção e já a devolve com os campos padrão', () => {
    const summary = service.create({ type: 'list', name: 'Vingadores' })

    expect(summary.type).toBe('list')
    expect(summary.name).toBe('Vingadores')
    expect(summary.coverMode).toBe('auto')
    expect(summary.coverUrl).toBeNull()
    expect(summary.itemCount).toBe(0)
  })

  it('rejeita nome duplicado no mesmo tipo com CONFLICT', () => {
    service.create({ type: 'list', name: 'Vingadores' })

    expect(() => service.create({ type: 'list', name: 'vingadores' })).toThrowError(AppError)
    try {
      service.create({ type: 'list', name: 'vingadores' })
    } catch (error) {
      expect((error as AppError).code).toBe('CONFLICT')
    }
  })

  it('cria já com HQs, se comicIds for passado', () => {
    const a = addComic()
    const b = addComic()

    const summary = service.create({ type: 'saga', name: 'Saga X', comicIds: [a, b] })

    expect(summary.itemCount).toBe(2)
  })

  it('get lança NOT_FOUND para id inexistente', () => {
    expect(() => service.get(randomUUID())).toThrowError(AppError)
  })

  it('get devolve os itens ordenados por position', () => {
    const a = addComic()
    const b = addComic()
    const summary = service.create({ type: 'list', name: 'Lista', comicIds: [a, b] })

    const detail = service.get(summary.id)
    expect(detail.items.map((i) => i.id)).toEqual([a, b])
    expect(detail.items.map((i) => i.position)).toEqual([0, 1])
  })

  it('update muda nome/descrição/tipo', () => {
    const summary = service.create({ type: 'list', name: 'Nome antigo' })

    const updated = service.update(summary.id, { name: 'Nome novo', type: 'saga' })

    expect(updated.name).toBe('Nome novo')
    expect(updated.type).toBe('saga')
  })

  it('update lança NOT_FOUND para id inexistente', () => {
    expect(() => service.update(randomUUID(), { name: 'X' })).toThrowError(AppError)
  })

  it('delete remove a coleção sem afetar as HQs', () => {
    const a = addComic()
    const summary = service.create({ type: 'list', name: 'Lista', comicIds: [a] })

    service.delete(summary.id)

    expect(() => service.get(summary.id)).toThrowError(AppError)
  })
})

describe('CollectionService.addItems/removeItems/reorder', () => {
  it('addItems devolve quantas foram de fato adicionadas (ignora repetidas)', () => {
    const a = addComic()
    const b = addComic()
    const summary = service.create({ type: 'list', name: 'Lista' })

    expect(service.addItems(summary.id, [a, b])).toEqual({ added: 2 })
    expect(service.addItems(summary.id, [a])).toEqual({ added: 0 })
  })

  it('removeItems tira a HQ da coleção sem excluí-la', () => {
    const a = addComic()
    const summary = service.create({ type: 'list', name: 'Lista', comicIds: [a] })

    service.removeItems(summary.id, [a])

    expect(service.get(summary.id).items).toEqual([])
  })

  it('reorder aplica a nova ordem e rejeita permutação inválida com VALIDATION', () => {
    const a = addComic()
    const b = addComic()
    const summary = service.create({ type: 'saga', name: 'Saga', comicIds: [a, b] })

    service.reorder(summary.id, [b, a])
    expect(service.get(summary.id).items.map((i) => i.id)).toEqual([b, a])

    expect(() => service.reorder(summary.id, [a])).toThrowError(AppError)
    try {
      service.reorder(summary.id, [a])
    } catch (error) {
      expect((error as AppError).code).toBe('VALIDATION')
    }
  })
})

describe('CollectionService.setCover', () => {
  it('modo auto grava e a capa resolvida cai no fallback da 1ª HQ', async () => {
    const a = addComic({ coverVersion: 2 })
    const summary = service.create({ type: 'list', name: 'Lista', comicIds: [a] })

    const result = await service.setCover(summary.id, { mode: 'auto' })

    expect(result.coverMode).toBe('auto')
    expect(result.coverUrl).toBe(`comic://cover/comic/${a}?v=2`)
  })

  it('modo comic com HQ inexistente lança NOT_FOUND', async () => {
    const summary = service.create({ type: 'list', name: 'Lista' })
    await expect(
      service.setCover(summary.id, { mode: 'comic', comicId: randomUUID() }),
    ).rejects.toThrowError(AppError)
  })

  it('modo image copia/redimensiona o arquivo e incrementa cover_version a cada troca', async () => {
    const summary = service.create({ type: 'list', name: 'Lista' })
    const sourceFile = join(root, 'source.jpg')
    writeFileSync(sourceFile, 'fake-image-bytes')

    const first = await service.setCover(summary.id, { mode: 'image', path: sourceFile })
    expect(first.coverUrl).toBe(`comic://cover/collection/${summary.id}?v=1`)

    const second = await service.setCover(summary.id, { mode: 'image', path: sourceFile })
    expect(second.coverUrl).toBe(`comic://cover/collection/${summary.id}?v=2`)
  })

  it('modo image com arquivo inexistente lança IO', async () => {
    const summary = service.create({ type: 'list', name: 'Lista' })

    await expect(
      service.setCover(summary.id, { mode: 'image', path: join(root, 'nao-existe.jpg') }),
    ).rejects.toThrowError(AppError)
  })
})

describe('CollectionService.membership', () => {
  it("'all' quando todas as HQs selecionadas estão na coleção, 'some' quando só parte", () => {
    const a = addComic()
    const b = addComic()
    const full = service.create({ type: 'list', name: 'Cheia', comicIds: [a, b] })
    const partial = service.create({ type: 'list', name: 'Parcial', comicIds: [a] })
    service.create({ type: 'list', name: 'Vazia' })

    const result = service.membership([a, b])

    expect(result[full.id]).toBe('all')
    expect(result[partial.id]).toBe('some')
  })
})

describe('CollectionService.nextToRead', () => {
  it('devolve a primeira não lida; se todas lidas, a primeira ("Ler novamente")', () => {
    const a = addComic()
    const b = addComic()
    const saga = service.create({ type: 'saga', name: 'Saga', comicIds: [a, b] })

    expect(service.nextToRead(saga.id)).toBe(a)

    markRead(db, a)
    expect(service.nextToRead(saga.id)).toBe(b)

    markRead(db, b)
    expect(service.nextToRead(saga.id)).toBe(a)
  })

  it('lança NOT_FOUND para uma saga inexistente', () => {
    expect(() => service.nextToRead(randomUUID())).toThrowError(AppError)
  })
})
