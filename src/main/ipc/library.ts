import { dialog } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import { AppError } from '@shared/errors'
import {
  zComicId,
  zComicIdList,
  zDeleteComicOptions,
  zFolderLocation,
  zLibraryQuery,
  zReadStatus,
  zTitle,
} from '@shared/schemas'
import type { FolderCoverService } from '../services/folder-cover-service'
import type { LibraryScanService } from '../services/library-scan-service'
import type { LibraryService } from '../services/library-service'
import { handle } from './handle'
async function pickImage(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
  })
  return result.canceled ? null : (result.filePaths[0] ?? null)
}
export function registerLibraryIpc(
  service: LibraryService,
  scanService: LibraryScanService,
  folderCovers: FolderCoverService,
): void {
  handle(CH.library.home, z.tuple([]), () => service.home())
  handle(CH.library.list, z.tuple([zLibraryQuery]), ([query]) => service.list(query))
  handle(CH.library.get, z.tuple([zComicId]), ([id]) => service.get(id))
  handle(CH.library.rename, z.tuple([zComicId, zTitle]), ([id, title]) => service.rename(id, title))
  handle(CH.library.setFavorite, z.tuple([zComicIdList, z.boolean()]), ([ids, value]) =>
    service.setFavorite(ids, value),
  )
  handle(CH.library.setReadStatus, z.tuple([zComicIdList, zReadStatus]), ([ids, status]) =>
    service.setReadStatus(ids, status),
  )
  handle(CH.library.delete, z.tuple([zComicIdList, zDeleteComicOptions]), ([ids, options]) =>
    service.delete(ids, options),
  )
  handle(CH.library.scan, z.tuple([]), () => scanService.scan())
  handle(CH.library.browseFolder, z.tuple([zFolderLocation]), ([location]) =>
    service.browseFolder(location),
  )
  handle(CH.library.setFolderCover, z.tuple([zFolderLocation]), async ([location]) => {
    if (location.folderId === null) throw new AppError('VALIDATION', 'errors.validation')
    const imagePath = await pickImage()
    if (!imagePath) return false
    await folderCovers.set(
      { folderId: location.folderId, relativePath: location.relativePath },
      imagePath,
    )
    return true
  })
  handle(CH.library.clearFolderCover, z.tuple([zFolderLocation]), async ([location]) => {
    if (location.folderId === null) throw new AppError('VALIDATION', 'errors.validation')
    await folderCovers.clear({ folderId: location.folderId, relativePath: location.relativePath })
  })
}
