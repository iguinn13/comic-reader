import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { insertComic } from '../db/repositories/comics'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { PageCacheService } from './page-cache-service'
import { StorageService } from './storage-service'

let root: string
let paths: AppPaths
let db: Db
let service: StorageService

function seedComic(id: string, fileSize: number): void {
  insertComic(db, {
    id,
    title: id,
    titleNormalized: id,
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: `${id}.cbz`,
    fileSize,
    fileHash: `hash-${id}`,
    pageCount: 1,
    createdAt: 1,
    updatedAt: 1,
    pages: [],
  })
}

function seedCache(comicId: string, bytes: number): void {
  const dir = paths.comicPagesCacheDir(comicId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '0000.jpg'), Buffer.alloc(bytes))
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-storage-'))
  paths = createAppPaths(root)
  mkdirSync(paths.cachePagesDir, { recursive: true })
  db = createDb(':memory:')
  service = new StorageService(db, new PageCacheService(db, paths))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('StorageService', () => {
  it('stats soma HQs, tamanho da biblioteca e bytes do cache', async () => {
    seedComic('a', 100)
    seedComic('b', 250)
    seedCache('a', 40)
    seedCache('b', 60)

    expect(await service.stats()).toEqual({ comicCount: 2, libraryBytes: 350, cacheBytes: 100 })
  })

  it('stats de uma biblioteca vazia é tudo zero', async () => {
    expect(await service.stats()).toEqual({ comicCount: 0, libraryBytes: 0, cacheBytes: 0 })
  })

  it('clearCache apaga o cache, devolve os bytes liberados e não toca a biblioteca', async () => {
    seedComic('a', 100)
    seedCache('a', 40)
    seedCache('b', 60)

    expect(await service.clearCache()).toEqual({ freedBytes: 100 })
    expect((await service.stats()).cacheBytes).toBe(0)
    expect((await service.stats()).comicCount).toBe(1)
  })
})
