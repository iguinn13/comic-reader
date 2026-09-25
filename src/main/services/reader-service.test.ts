import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@shared/errors'
import { DEFAULT_READER_PREFS } from '@shared/constants'
import { createDb, type Db } from '../db/client'
import { addItems, createCollection } from '../db/repositories/collections'
import { insertComic, type InsertComicInput } from '../db/repositories/comics'
import { getProgress, setCurrentPage } from '../db/repositories/progress'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { PageCacheService } from './page-cache-service'
import { ReaderService } from './reader-service'

const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')

let root: string
let paths: AppPaths
let db: Db
let pageCache: PageCacheService
let service: ReaderService

function seedComic(overrides: Partial<InsertComicInput> = {}): string {
  const id = overrides.id ?? 'c1'
  copyFileSync(join(FIXTURES_DIR, 'simple.cbz'), paths.comicFile(id, 'cbz'))
  const input: InsertComicInput = {
    id,
    title: 'Batman - Ano Um 01',
    titleNormalized: 'batman - ano um 01',
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: 'Batman_-_Ano_Um_01.cbz',
    fileSize: 4245,
    fileHash: `hash-${id}`,
    pageCount: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: Array.from({ length: 5 }, (_, i) => ({ pageIndex: i, entryName: `0${i + 1}.jpg` })),
    ...overrides,
  }
  insertComic(db, input)
  return id
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-reader-service-'))
  paths = createAppPaths(root)
  mkdirSync(paths.libraryDir, { recursive: true })
  mkdirSync(paths.cachePagesDir, { recursive: true })
  db = createDb(':memory:')
  pageCache = new PageCacheService(db, paths)
  service = new ReaderService(db, paths, pageCache)
})

afterEach(() => {
  vi.useRealTimers()
  rmSync(root, { recursive: true, force: true })
})

describe('ReaderService.open', () => {
  it('lança NOT_FOUND para uma HQ inexistente', () => {
    expect(() => service.open('nope')).toThrowError(AppError)
  })

  it('lança FILE_MISSING quando o arquivo sumiu da biblioteca', () => {
    const id = seedComic()
    rmSync(paths.comicFile(id, 'cbz'))
    try {
      service.open(id)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe('FILE_MISSING')
    }
  })

  it('monta a fonte "images" com as URLs comic://page/{id}/{n} em ordem', () => {
    const id = seedComic()
    const session = service.open(id)

    expect(session.source.kind).toBe('images')
    if (session.source.kind !== 'images') throw new Error('esperava images')
    expect(session.source.pages.map((p) => p.url)).toEqual([
      `comic://page/${id}/0`,
      `comic://page/${id}/1`,
      `comic://page/${id}/2`,
      `comic://page/${id}/3`,
      `comic://page/${id}/4`,
    ])
  })

  it('usa os padrões globais quando a HQ não tem preferências próprias', () => {
    const id = seedComic()
    const session = service.open(id)
    expect(session.prefs).toEqual(DEFAULT_READER_PREFS)
    expect(session.hasCustomPrefs).toBe(false)
  })

  it('sagaContext fica vazio até o CollectionService existir (M5)', () => {
    const id = seedComic()
    expect(service.open(id).sagaContext).toEqual([])
  })
})

describe('ReaderService.setPage / flush', () => {
  it('faz debounce da escrita e grava só depois do flush', () => {
    vi.useFakeTimers()
    const id = seedComic()

    service.setPage(id, 3)
    expect(getProgress(db, id)?.currentPage).toBe(0)

    vi.advanceTimersByTime(500)
    expect(getProgress(db, id)?.currentPage).toBe(3)
  })

  it('close() força o flush imediatamente, sem esperar o debounce', () => {
    const id = seedComic()
    service.setPage(id, 2)
    service.close(id)
    expect(getProgress(db, id)?.currentPage).toBe(2)
  })

  it('flush() sem argumento grava todas as HQs pendentes', () => {
    const a = seedComic({ id: 'a' })
    const b = seedComic({ id: 'b' })
    service.setPage(a, 1)
    service.setPage(b, 4)
    service.flush()
    expect(getProgress(db, a)?.currentPage).toBe(1)
    expect(getProgress(db, b)?.currentPage).toBe(4)
  })
})

describe('ReaderService prefs/complete', () => {
  it('savePrefs grava e o próximo open devolve hasCustomPrefs true', () => {
    const id = seedComic()
    service.savePrefs(id, { ...DEFAULT_READER_PREFS, mode: 'vertical' })
    const session = service.open(id)
    expect(session.prefs.mode).toBe('vertical')
    expect(session.hasCustomPrefs).toBe(true)
  })

  it('resetPrefs volta aos padrões globais', () => {
    const id = seedComic()
    service.savePrefs(id, { ...DEFAULT_READER_PREFS, mode: 'double' })
    const prefs = service.resetPrefs(id)
    expect(prefs).toEqual(DEFAULT_READER_PREFS)
    expect(service.open(id).hasCustomPrefs).toBe(false)
  })

  it('complete marca a HQ como lida', () => {
    const id = seedComic()
    setCurrentPage(db, id, 4)
    service.complete(id)
    expect(getProgress(db, id)?.completedAt).not.toBeNull()
  })
})

describe('ReaderService.open — sagaContext', () => {
  function makeSaga(id: string, name: string, comicIds: string[]): void {
    createCollection(db, {
      id,
      type: 'saga',
      name,
      nameNormalized: name.toLowerCase(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    addItems(db, id, comicIds)
  }

  it('lista as sagas da HQ com posição, total e próxima, a saga de origem primeiro', () => {
    const a = seedComic({ id: 'a', title: 'A' })
    const b = seedComic({ id: 'b', title: 'B' })
    makeSaga('saga-1', 'Alfa', [a, b])
    makeSaga('saga-2', 'Beta', [b, a])

    const session = service.open(a, 'saga-2')

    expect(session.sagaContext.map((s) => s.sagaId)).toEqual(['saga-2', 'saga-1'])
    const alfa = session.sagaContext.find((s) => s.sagaId === 'saga-1')
    expect(alfa).toMatchObject({ position: 0, total: 2 })
    expect(alfa?.next?.id).toBe(b)
    // Na saga Beta, a HQ "a" é a última: sem próxima.
    expect(session.sagaContext[0]?.next).toBeNull()
  })

  it('listas não entram no contexto', () => {
    const a = seedComic({ id: 'a' })
    createCollection(db, {
      id: 'lista',
      type: 'list',
      name: 'Lista',
      nameNormalized: 'lista',
      createdAt: 1,
      updatedAt: 1,
    })
    addItems(db, 'lista', [a])

    expect(service.open(a).sagaContext).toEqual([])
  })
})
