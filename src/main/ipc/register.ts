import type { Db } from '../db/client'
import type { FolderCoverService } from '../services/folder-cover-service'
import type { LibraryScanService } from '../services/library-scan-service'
import type { LibraryService } from '../services/library-service'
import type { ReaderService } from '../services/reader-service'
import type { SettingsService } from '../services/settings-service'
import { registerLibraryFoldersIpc } from './library-folders'
import { registerLibraryIpc } from './library'
import { registerReaderIpc } from './reader'
import { registerSettingsIpc } from './settings'
export interface AppServices {
  db: Db
  settingsService: SettingsService
  libraryService: LibraryService
  folderCoverService: FolderCoverService
  libraryScanService: LibraryScanService
  readerService: ReaderService
}
export function registerAllIpc(services: AppServices): void {
  registerSettingsIpc(services.settingsService)
  registerLibraryIpc(
    services.libraryService,
    services.libraryScanService,
    services.folderCoverService,
  )
  registerLibraryFoldersIpc(services.db, services.libraryScanService)
  registerReaderIpc(services.readerService)
}
