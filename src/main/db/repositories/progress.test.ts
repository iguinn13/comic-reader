import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../client'
import { readingProgress } from '../schema'
import { insertComic, type InsertComicInput } from './comics'
import { insertLibraryFolder } from './library-folders'
import {
  getContinueReading,
  getProgress,
  getRecentlyAdded,
  markRead,
  markUnread,
  resetAllReaderPrefs,
  setCurrentPage,
} from './progress'

let db: Db
let folderId: string

function makeInput(overrides: Partial<InsertComicInput> = {}): InsertComicInput {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    title: 'HQ de Teste',
    titleNormalized: 'hq de teste',
    format: 'zip',
    filePath: `/comics/hq-${id}.cbz`,
    dirPath: '/comics',
    folderId,
    originalFileName: 'hq.cbz',
    fileSize: 1024,
    fileHash: `hash-${id}`,
    pageCount: 10,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
    ...overrides,
  }
}

beforeEach(() => {
  db = createDb(':memory:')
  folderId = randomUUID()
  insertLibraryFolder(db, { id: folderId, path: '/comics' })
})

describe('getProgress', () => {
  it('devolve a linha de progresso criada junto com a HQ', () => {
    const input = makeInput()
    insertComic(db, input)

    const progress = getProgress(db, input.id)
    expect(progress).toEqual({
      comicId: input.id,
      currentPage: 0,
      lastReadAt: null,
      completedAt: null,
      readerPrefs: null,
    })
  })

  it('devolve null para uma HQ inexistente', () => {
    expect(getProgress(db, randomUUID())).toBeNull()
  })
})

describe('setCurrentPage', () => {
  it('atualiza a página atual e last_read_at, sem mexer em completed_at', () => {
    const input = makeInput()
    insertComic(db, input)
    markRead(db, input.id)

    setCurrentPage(db, input.id, 5)

    const progress = getProgress(db, input.id)
    expect(progress?.currentPage).toBe(5)
    expect(progress?.lastReadAt).not.toBeNull()
    // Reabrir uma HQ lida e navegar não remove a marca de lida (docs/03 §2.3).
    expect(progress?.completedAt).not.toBeNull()
  })
})

describe('markRead', () => {
  it('define completed_at e mantém current_page', () => {
    const input = makeInput()
    insertComic(db, input)
    setCurrentPage(db, input.id, 7)

    markRead(db, input.id)

    const progress = getProgress(db, input.id)
    expect(progress?.completedAt).not.toBeNull()
    expect(progress?.currentPage).toBe(7)
  })
})

describe('markUnread', () => {
  it('zera completed_at, current_page e last_read_at', () => {
    const input = makeInput()
    insertComic(db, input)
    setCurrentPage(db, input.id, 7)
    markRead(db, input.id)

    markUnread(db, input.id)

    const progress = getProgress(db, input.id)
    expect(progress).toEqual({
      comicId: input.id,
      currentPage: 0,
      lastReadAt: null,
      completedAt: null,
      readerPrefs: null,
    })
  })
})

describe('getContinueReading', () => {
  it('filtra HQs em andamento (não lidas, com página > 0) e ordena por last_read_at desc', async () => {
    const neverOpened = makeInput()
    const finished = makeInput()
    const older = makeInput()
    const newer = makeInput()
    insertComic(db, neverOpened)
    insertComic(db, finished)
    insertComic(db, older)
    insertComic(db, newer)

    markRead(db, finished.id)
    setCurrentPage(db, finished.id, 3)

    setCurrentPage(db, older.id, 1)
    await new Promise((resolve) => setTimeout(resolve, 5))
    setCurrentPage(db, newer.id, 1)

    const result = getContinueReading(db, 20)

    expect(result.map((c) => c.id)).toEqual([newer.id, older.id])
  })

  it('respeita o limite', () => {
    for (let i = 0; i < 3; i++) {
      const input = makeInput()
      insertComic(db, input)
      setCurrentPage(db, input.id, 1)
    }

    expect(getContinueReading(db, 2)).toHaveLength(2)
  })
})

describe('getRecentlyAdded', () => {
  it('ordena pelas HQs mais recentes primeiro', () => {
    const first = makeInput({ createdAt: 1000 })
    const second = makeInput({ createdAt: 2000 })
    insertComic(db, first)
    insertComic(db, second)

    const result = getRecentlyAdded(db, 20)
    expect(result.map((c) => c.id)).toEqual([second.id, first.id])
  })
})

describe('resetAllReaderPrefs', () => {
  it('limpa reader_prefs de todas as HQs (RF-50 "Aplicar a todas")', () => {
    const a = makeInput()
    const b = makeInput()
    insertComic(db, a)
    insertComic(db, b)
    db.update(readingProgress)
      .set({ readerPrefs: '{"mode":"vertical"}' })
      .where(eq(readingProgress.comicId, a.id))
      .run()
    db.update(readingProgress)
      .set({ readerPrefs: '{"mode":"double"}' })
      .where(eq(readingProgress.comicId, b.id))
      .run()

    resetAllReaderPrefs(db)

    expect(getProgress(db, a.id)?.readerPrefs).toBeNull()
    expect(getProgress(db, b.id)?.readerPrefs).toBeNull()
  })
})
