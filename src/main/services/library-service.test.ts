import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import { createDb, type Db } from '../db/client'
import { addItems, createCollection } from '../db/repositories/collections'
import { insertComic, type InsertComicInput } from '../db/repositories/comics'
import { markRead, setCurrentPage } from '../db/repositories/progress'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { LibraryService } from './library-service'

let db: Db
let service: LibraryService
let root: string
let paths: AppPaths

function makeInput(overrides: Partial<InsertComicInput> = {}): InsertComicInput {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    title: 'Batman - Ano Um 01',
    titleNormalized: 'batman - ano um 01',
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: 'Batman_-_Ano_Um_01.cbz',
    fileSize: 1024,
    fileHash: `hash-${id}`,
    pageCount: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
    ...overrides,
  }
}

beforeEach(() => {
  db = createDb(':memory:')
  root = mkdtempSync(join(tmpdir(), 'comic-reader-library-'))
  paths = createAppPaths(root)
  service = new LibraryService(db, paths)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('LibraryService.get/list', () => {
  it('lança NOT_FOUND para um id inexistente', () => {
    expect(() => service.get(randomUUID())).toThrowError(AppError)
  })

  it('coverUrl é null com coverVersion 0 (capa ainda não gerada)', () => {
    const input = makeInput()
    insertComic(db, input)

    const detail = service.get(input.id)
    expect(detail.coverUrl).toBeNull()
  })

  it('coverUrl aponta pra comic://cover/comic/{id}?v={coverVersion}', () => {
    const input = makeInput({ coverVersion: 3 })
    insertComic(db, input)

    const detail = service.get(input.id)
    expect(detail.coverUrl).toBe(`comic://cover/comic/${input.id}?v=3`)
  })

  it('calcula progress como (currentPage+1)/pageCount enquanto não está lida', () => {
    const input = makeInput({ pageCount: 4 })
    insertComic(db, input)
    setCurrentPage(db, input.id, 1)

    const { items } = service.list({
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 10,
      offset: 0,
    })

    expect(items[0]?.progress).toBe(0.5)
  })
})

describe('LibraryService.setFavorite/setReadStatus/delete', () => {
  it('favorita e remove o favorito por lote', () => {
    const a = makeInput()
    const b = makeInput()
    insertComic(db, a)
    insertComic(db, b)

    service.setFavorite([a.id, b.id], true)
    expect(service.get(a.id).isFavorite).toBe(true)
    expect(service.get(b.id).isFavorite).toBe(true)

    service.setFavorite([a.id], false)
    expect(service.get(a.id).isFavorite).toBe(false)
    expect(service.get(b.id).isFavorite).toBe(true)
  })

  it('marca como lida e depois como não lida', () => {
    const input = makeInput()
    insertComic(db, input)

    service.setReadStatus([input.id], 'read')
    expect(service.get(input.id).status).toBe('read')
    expect(service.get(input.id).progress).toBe(1)

    service.setReadStatus([input.id], 'unread')
    expect(service.get(input.id).status).toBe('unread')
    expect(service.get(input.id).currentPage).toBe(0)
  })

  it('exclui e devolve a contagem de excluídas', async () => {
    const input = makeInput()
    insertComic(db, input)

    expect(await service.delete([input.id])).toEqual({ deleted: 1 })
    expect(() => service.get(input.id)).toThrowError(AppError)
  })

  it('apaga também o arquivo, a capa e o cache da HQ (RF-17)', async () => {
    const input = makeInput()
    insertComic(db, input)
    mkdirSync(paths.libraryDir, { recursive: true })
    mkdirSync(paths.coversComicsDir, { recursive: true })
    mkdirSync(paths.comicPagesCacheDir(input.id), { recursive: true })
    writeFileSync(paths.comicFile(input.id, 'cbz'), 'x')
    writeFileSync(paths.comicCoverFile(input.id), 'x')

    await service.delete([input.id])

    expect(existsSync(paths.comicFile(input.id, 'cbz'))).toBe(false)
    expect(existsSync(paths.comicCoverFile(input.id))).toBe(false)
    expect(existsSync(paths.comicPagesCacheDir(input.id))).toBe(false)
  })
})

describe('LibraryService.home', () => {
  it('separa continueReading (em andamento) de recentlyAdded', () => {
    const reading = makeInput()
    const untouched = makeInput()
    insertComic(db, reading)
    insertComic(db, untouched)
    setCurrentPage(db, reading.id, 1)

    const home = service.home()
    expect(home.continueReading.map((c) => c.id)).toEqual([reading.id])
    expect(home.recentlyAdded.map((c) => c.id).sort()).toEqual([reading.id, untouched.id].sort())
    expect(home.sagasInProgress).toEqual([])
  })
})

describe('LibraryService.home — sagasInProgress (RF-63)', () => {
  it('só inclui sagas com ao menos 1 lida e 1 não lida', () => {
    const [a, b, c] = [makeInput(), makeInput(), makeInput()]
    for (const comic of [a, b, c]) insertComic(db, comic)
    const now = Date.now()
    const saga = (id: string, name: string, comics: string[]): void => {
      createCollection(db, {
        id,
        type: 'saga',
        name,
        nameNormalized: name,
        createdAt: now,
        updatedAt: now,
      })
      addItems(db, id, comics)
    }
    saga('em-andamento', 'a', [a.id, b.id])
    saga('nao-iniciada', 'b', [c.id])
    markRead(db, a.id)

    expect(service.home().sagasInProgress.map((s) => s.id)).toEqual(['em-andamento'])
  })
})
