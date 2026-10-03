import { app, BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { mkdir } from 'fs/promises'
import { CH } from '@shared/channels'
import { closeDb, createDb, type Db } from './db/client'
import { registerAppIpc, watchFullscreenChanges } from './ipc/app'
import { registerAllIpc } from './ipc/register'
import { registerComicProtocolAsPrivileged, registerComicProtocolHandler } from './protocol'
import { CoverService } from './services/cover-service'
import { LibraryScanService } from './services/library-scan-service'
import { FolderCoverService } from './services/folder-cover-service'
import { LibraryService } from './services/library-service'
import { MaintenanceService } from './services/maintenance-service'
import { PageCacheService } from './services/page-cache-service'
import { ReaderService } from './services/reader-service'
import { StorageService } from './services/storage-service'
import { SettingsService } from './services/settings-service'
import { initLogger, logger } from './utils/logger'
import { setPerfLogging } from './utils/perf'
import { resizeToJpeg } from './utils/native-image-adapter'
import { createAppPaths } from './utils/paths'
import { createMainWindow } from './window'
registerComicProtocolAsPrivileged()
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}
const userDataOverride = process.env['COMIC_READER_USER_DATA']
if (userDataOverride && (!app.isPackaged || process.env['COMIC_READER_E2E'])) {
  app.setPath('userData', userDataOverride)
}
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows()
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore()
      existingWindow.focus()
    }
  })
  const paths = createAppPaths(app.getPath('userData'))
  let db: Db | null = null
  let readerServiceRef: ReaderService | null = null
  async function bootstrap(): Promise<void> {
    initLogger(paths)
    setPerfLogging(is.dev)
    await Promise.all(paths.allDirectories.map((dir) => mkdir(dir, { recursive: true })))
    logger.info('Diretórios de dados prontos em', paths.root)
    electronApp.setAppUserModelId('com.comicreader.app')
    db = createDb(paths.dbFile)
    const settingsService = new SettingsService(db, () => void pageCacheService.enforceLru(null))
    const folderCoverService = new FolderCoverService(paths, resizeToJpeg)
    const libraryService = new LibraryService(db, paths, folderCoverService)
    const pageCacheService = new PageCacheService(db, paths)
    const readerService = new ReaderService(db, pageCacheService)
    readerServiceRef = readerService
    let mainWindow: BrowserWindow | null = null
    const coverService = new CoverService(paths, resizeToJpeg)
    const libraryScanService = new LibraryScanService(db, coverService, libraryService, {
      onProgress: (state) => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send(CH.library.onScanProgress, state)
      },
      onChanged: (reason) => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        mainWindow.webContents.send(CH.library.onChanged, reason)
      },
    })
    const maintenanceService = new MaintenanceService(db, paths)
    await maintenanceService.run()
    registerComicProtocolHandler(paths, db, pageCacheService)
    registerAllIpc({
      db,
      settingsService,
      libraryService,
      folderCoverService,
      libraryScanService,
      readerService,
    })
    registerAppIpc(() => mainWindow, new StorageService(db, pageCacheService), {
      version: app.getVersion(),
      userDataPath: paths.root,
    })
    void pageCacheService.enforceLru(null)
    void libraryScanService.scan()
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
    const openWindow = (): void => {
      mainWindow = createMainWindow({
        initialBounds: settingsService.get()['window.bounds'],
        onBoundsChange: (bounds) => settingsService.update({ 'window.bounds': bounds }),
      })
      mainWindow.webContents.on('render-process-gone', () => {
        readerService.flush()
        mainWindow?.webContents.reload()
      })
      watchFullscreenChanges(mainWindow)
    }
    openWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openWindow()
    })
  }
  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      console.error('Falha ao inicializar o app:', error)
      app.quit()
    })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  app.on('before-quit', () => {
    readerServiceRef?.flush()
  })
  app.on('will-quit', () => {
    if (db) {
      closeDb(db)
      db = null
    }
  })
}
