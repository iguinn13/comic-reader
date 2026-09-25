import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../db/client'
import { insertComic } from '../db/repositories/comics'
import { insertLibraryFolder } from '../db/repositories/library-folders'
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
  it('remove capas órfãs em covers/comics/, mantendo as de HQs existentes', async () => {
    const folderId = randomUUID()
    insertLibraryFolder(db, { id: folderId, path: root })

    const keptId = randomUUID()
    insertComic(db, {
      id: keptId,
      title: 'Mantida',
      titleNormalized: 'mantida',
      format: 'zip',
      filePath: join(root, 'Mantida.cbz'),
      dirPath: root,
      folderId,
      originalFileName: 'Mantida.cbz',
      fileSize: 10,
      fileHash: 'hash-1',
      pageCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pages: [{ pageIndex: 0, entryName: '01.jpg' }],
    })

    writeFileSync(paths.comicCoverFile(keptId), 'capa válida')

    const orphanId = randomUUID()
    writeFileSync(paths.comicCoverFile(orphanId), 'capa órfã')

    const service = new MaintenanceService(db, paths)
    await service.run()

    expect(existsSync(paths.comicCoverFile(keptId))).toBe(true)
    expect(existsSync(paths.comicCoverFile(orphanId))).toBe(false)
  })
})
