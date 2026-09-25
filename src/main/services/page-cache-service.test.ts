import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { imageSize } from 'image-size'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { insertComic, type InsertComicInput } from '../db/repositories/comics'
import { setSetting } from '../db/repositories/settings'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { buildExtractionOrder, PageCacheService } from './page-cache-service'

const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')

let root: string
let paths: AppPaths
let db: Db
let service: PageCacheService

/** Copia `simple.cbz` (5 páginas de 200×300, docs/09 §3) pra `library/` e insere a linha da HQ. */
function seedComic(id: string, pageCount = 5): void {
  copyFileSync(join(FIXTURES_DIR, 'simple.cbz'), paths.comicFile(id, 'cbz'))
  const input: InsertComicInput = {
    id,
    title: `HQ ${id}`,
    titleNormalized: `hq ${id}`,
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: 'simple.cbz',
    fileSize: 1024,
    fileHash: `hash-${id}`,
    pageCount,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: Array.from({ length: pageCount }, (_, i) => ({
      pageIndex: i,
      entryName: `0${i + 1}.jpg`,
    })),
  }
  insertComic(db, input)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-page-cache-'))
  paths = createAppPaths(root)
  mkdirSync(paths.libraryDir, { recursive: true })
  mkdirSync(paths.cachePagesDir, { recursive: true })
  db = createDb(':memory:')
  service = new PageCacheService(db, paths)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando a extração')
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe('buildExtractionOrder', () => {
  it('vai da página atual até o fim, depois do início até a página anterior', () => {
    expect(buildExtractionOrder(2, 5)).toEqual([2, 3, 4, 1, 0])
    expect(buildExtractionOrder(0, 5)).toEqual([0, 1, 2, 3, 4])
    expect(buildExtractionOrder(4, 5)).toEqual([4, 3, 2, 1, 0])
  })
})

describe('PageCacheService.getPage', () => {
  it('extrai a página sob demanda, grava no cache e mede as dimensões', async () => {
    seedComic('c1')

    const result = await service.getPage('c1', 0)
    expect(existsSync(result.path)).toBe(true)
    expect(result.contentType).toBe('image/jpeg')

    // As fixtures são PNG por baixo (docs/09 §3), embora nomeadas ".jpg"
    // dentro do CBZ — o Content-Type servido segue a extensão da entrada.
    const dims = imageSize(readFileSync(result.path))
    expect(dims).toEqual({ width: 200, height: 300, type: 'png' })
  })

  it('não reextrai uma página já cacheada', async () => {
    seedComic('c1')
    const first = await service.getPage('c1', 1)
    const secondCallStillExists = existsSync(first.path)
    const second = await service.getPage('c1', 1)
    expect(secondCallStillExists).toBe(true)
    expect(second.path).toBe(first.path)
  })
})

describe('PageCacheService.ensure', () => {
  it('extrai todas as páginas em segundo plano e grava o marcador .complete', async () => {
    seedComic('c1')
    service.ensure('c1', 0)

    const marker = paths.comicPagesCompleteMarker('c1')
    await waitFor(() => existsSync(marker))

    for (let i = 0; i < 5; i++) {
      expect(existsSync(paths.comicPageCacheFile('c1', i, 'jpg'))).toBe(true)
    }
  })

  it('não inicia uma segunda extração enquanto a primeira está em andamento', async () => {
    seedComic('c1')
    service.ensure('c1', 0)
    service.ensure('c1', 0)

    await waitFor(() => existsSync(paths.comicPagesCompleteMarker('c1')))
    expect(existsSync(paths.comicPagesCompleteMarker('c1'))).toBe(true)
  })
})

describe('PageCacheService.enforceLru', () => {
  it('remove o cache das HQs menos acessadas até caber em cache.maxBytes, sem tocar a HQ aberta', async () => {
    seedComic('old')
    seedComic('new')
    seedComic('open')

    service.ensure('old', 0)
    service.ensure('new', 0)
    service.ensure('open', 0)
    await waitFor(
      () =>
        existsSync(paths.comicPagesCompleteMarker('old')) &&
        existsSync(paths.comicPagesCompleteMarker('new')) &&
        existsSync(paths.comicPagesCompleteMarker('open')),
    )

    // `old` foi "acessada" há muito tempo; `new` e `open`, agora.
    const past = new Date(Date.now() - 60_000)
    utimesSync(paths.comicPagesCompleteMarker('old'), past, past)

    // Cada HQ extraída ocupa ~4,2 KB (5 páginas de 849 bytes); 10 KB só cabe
    // duas das três, então exatamente uma precisa ser removida: a mais antiga.
    setSetting(db, 'cache.maxBytes', 10_000)

    await service.enforceLru('open')

    expect(existsSync(paths.comicPagesCacheDir('old'))).toBe(false)
    expect(existsSync(paths.comicPagesCacheDir('new'))).toBe(true)
    expect(existsSync(paths.comicPagesCacheDir('open'))).toBe(true)
  })
})
