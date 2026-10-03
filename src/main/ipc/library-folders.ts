import { randomUUID } from 'crypto'
import { dialog } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import { AppError } from '@shared/errors'
import { zFolderId } from '@shared/schemas'
import type { LibraryFolder } from '@shared/types'
import type { Db } from '../db/client'
import {
  deleteLibraryFolder,
  getLibraryFolder,
  getLibraryFolderByPath,
  insertLibraryFolder,
  listLibraryFolders,
} from '../db/repositories/library-folders'
import type { LibraryScanService } from '../services/library-scan-service'
import { handle } from './handle'
function toDto(row: { id: string; path: string; createdAt: number }): LibraryFolder {
  return { id: row.id, path: row.path, addedAt: row.createdAt }
}
async function pickFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : (result.filePaths[0] ?? null)
}
export function registerLibraryFoldersIpc(db: Db, scanService: LibraryScanService): void {
  handle(CH.libraryFolders.list, z.tuple([]), () => listLibraryFolders(db).map(toDto))
  handle(CH.libraryFolders.add, z.tuple([]), async () => {
    const e2eFolder = process.env['COMIC_READER_E2E'] && process.env['COMIC_READER_E2E_FOLDER']
    const path = e2eFolder || (await pickFolder())
    if (!path) return null
    const existing = getLibraryFolderByPath(db, path)
    if (existing) throw new AppError('CONFLICT', 'errors.folderAlreadyAdded')
    const id = randomUUID()
    insertLibraryFolder(db, { id, path })
    await scanService.scan()
    return toDto(getLibraryFolder(db, id)!)
  })
  handle(CH.libraryFolders.remove, z.tuple([zFolderId]), ([id]) => {
    deleteLibraryFolder(db, id)
  })
}
