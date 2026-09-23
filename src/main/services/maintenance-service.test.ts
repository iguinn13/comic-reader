import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { insertComic } from '../db/repositories/comics'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { MaintenanceService } from './maintenance-service'

let root: string
let paths: AppPaths
let db: Db

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-maintenance-'))
  paths = createAppPaths(root)
  for (const dir of paths.allDirectories) mkdirSync(dir, { recursive: true })
  db = createDb(':memory:')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('MaintenanceService.run', () => {
  it('apaga tudo em cache/tmp', async () => {
    writeFileSync(join(paths.cacheTmpDir, 'sobra.part'), 'x')
    const service = new MaintenanceService(db, paths)

    await service.run()

    expect(readdirSync(paths.cacheTmpDir)).toHaveLength(0)
  })

  it('remove arquivos órfãos em library/ e covers/comics/, mantendo os de HQs existentes', async () => {
    const keptId = randomUUID()
    insertComic(db, {
      id: keptId,
      title: 'Mantida',
      titleNormalized: 'mantida',
      format: 'zip',
      fileName: `${keptId}.cbz`,
      originalFileName: 'Mantida.cbz',
      fileSize: 10,
      fileHash: 'hash-1',
      pageCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pages: [{ pageIndex: 0, entryName: '01.jpg' }],
    })

    writeFileSync(paths.comicFile(keptId, 'cbz'), 'conteúdo válido')
    writeFileSync(paths.comicCoverFile(keptId), 'capa válida')

    const orphanId = randomUUID()
    writeFileSync(paths.comicFile(orphanId, 'cbz'), 'órfão')
    writeFileSync(paths.comicCoverFile(orphanId), 'capa órfã')

    const service = new MaintenanceService(db, paths)
    await service.run()

    expect(existsSync(paths.comicFile(keptId, 'cbz'))).toBe(true)
    expect(existsSync(paths.comicCoverFile(keptId))).toBe(true)
    expect(existsSync(paths.comicFile(orphanId, 'cbz'))).toBe(false)
    expect(existsSync(paths.comicCoverFile(orphanId))).toBe(false)
  })
})
