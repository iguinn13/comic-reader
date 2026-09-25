import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { insertComic } from '../db/repositories/comics'
import { markRead, setCurrentPage } from '../db/repositories/progress'
import { createAppPaths } from '../utils/paths'
import { LibraryService } from './library-service'

/**
 * RNF-02 (docs/01 §5): com 5.000 HQs, busca/filtro respondem em < 200 ms e a
 * consulta do Início é rápida. Mede só o backend (SQLite + DTOs); a rolagem a
 * 60 fps da grade é garantida pela virtualização no renderer. Os limites
 * abaixo são o do requisito, com folga de máquina lenta no CI.
 */
const COUNT = 5000
const SEARCH_LIMIT_MS = 200
const HOME_LIMIT_MS = 300

let db: Db
let service: LibraryService

function timed<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now()
  const result = fn()
  return { result, ms: performance.now() - start }
}

beforeAll(() => {
  db = createDb(':memory:')
  service = new LibraryService(db, createAppPaths(tmpdir()))
  const now = Date.now()
  for (let i = 0; i < COUNT; i++) {
    const id = randomUUID()
    const title = `Batman ${i % 7 === 0 ? 'Ação' : 'Saga'} #${i}`
    insertComic(db, {
      id,
      title,
      titleNormalized: title
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase(),
      format: 'zip',
      fileName: `${id}.cbz`,
      originalFileName: `${title}.cbz`,
      fileSize: 1000,
      fileHash: `hash-${id}`,
      pageCount: 30,
      createdAt: now - i,
      updatedAt: now - i,
      pages: [],
    })
    if (i % 5 === 0) markRead(db, id)
    else if (i % 3 === 0) setCurrentPage(db, id, 4)
  }
}, 60_000)

const baseQuery = {
  sort: 'createdAt',
  order: 'desc',
  status: 'all',
  favoritesOnly: false,
  limit: 60,
  offset: 0,
} as const

describe(`Biblioteca com ${COUNT} HQs (RNF-02)`, () => {
  it('busca sem acento responde em < 200 ms', () => {
    const { result, ms } = timed(() => service.list({ ...baseQuery, search: 'acao' }))
    expect(result.total).toBeGreaterThan(0)
    expect(ms).toBeLessThan(SEARCH_LIMIT_MS)
  })

  it.each(['title', 'createdAt', 'lastReadAt'] as const)('ordenar por %s em < 200 ms', (sort) => {
    const { ms } = timed(() => service.list({ ...baseQuery, sort }))
    expect(ms).toBeLessThan(SEARCH_LIMIT_MS)
  })

  it('filtro de status e paginação profunda em < 200 ms', () => {
    const filtered = timed(() => service.list({ ...baseQuery, status: 'reading' }))
    const deep = timed(() => service.list({ ...baseQuery, offset: 4900 }))
    expect(filtered.ms).toBeLessThan(SEARCH_LIMIT_MS)
    expect(deep.result.items.length).toBeGreaterThan(0)
    expect(deep.ms).toBeLessThan(SEARCH_LIMIT_MS)
  })

  it('consulta do Início (boot) rápida', () => {
    const { ms } = timed(() => service.home())
    expect(ms).toBeLessThan(HOME_LIMIT_MS)
  })
})
