import { app, BrowserWindow } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { mkdir } from 'fs/promises'
import { CH } from '@shared/channels'
import { closeDb, createDb, type Db } from './db/client'
import { registerAppIpc, watchFullscreenChanges } from './ipc/app'
import { registerAllIpc } from './ipc/register'
import { registerComicProtocolAsPrivileged, registerComicProtocolHandler } from './protocol'
import { CollectionService } from './services/collection-service'
import { CoverService } from './services/cover-service'
import { ImportService } from './services/import-service'
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

// Boot passo 2 (docs/02-arquitetura.md §7): o esquema privilegiado precisa
// ser registrado antes de `app.ready`, então fica fora de `bootstrap()`.
registerComicProtocolAsPrivileged()

// A v1 tem como alvo só o Windows (ADR-012): esta trava de GPU só serve para
// permitir desenvolvimento em Linux/WSL, onde o processo de GPU do Chromium
// costuma falhar (WSLg sem suporte completo). Não afeta o build de produção.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

// E2E (docs/09 §2.3): cada teste roda com um `userData` temporário. Só vale em
// build não empacotado ou com `COMIC_READER_E2E` — nunca no app instalado.
const userDataOverride = process.env['COMIC_READER_USER_DATA']
if (userDataOverride && (!app.isPackaged || process.env['COMIC_READER_E2E'])) {
  app.setPath('userData', userDataOverride)
}

// Trava de instância única (docs/02-arquitetura.md §6): uma segunda instância
// apenas foca a janela existente, em vez de abrir um segundo processo com
// acesso ao mesmo banco SQLite.
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
    // RNF-01: em dev, registra o tempo de cada página servida.
    setPerfLogging(is.dev)
    await Promise.all(paths.allDirectories.map((dir) => mkdir(dir, { recursive: true })))
    logger.info('Diretórios de dados prontos em', paths.root)

    electronApp.setAppUserModelId('com.comicreader.app')

    db = createDb(paths.dbFile)
    const settingsService = new SettingsService(db, () => void pageCacheService.enforceLru(null))
    const libraryService = new LibraryService(db, paths)
    const pageCacheService = new PageCacheService(db, paths)
    const readerService = new ReaderService(db, paths, pageCacheService)
    readerServiceRef = readerService

    let mainWindow: BrowserWindow | null = null

    const coverService = new CoverService(paths, resizeToJpeg)
    const collectionService = new CollectionService(db, coverService)
    const importService = new ImportService(db, paths, coverService, (state) => {
      // `ImportService` não conhece `BrowserWindow` (injeção, docs/02 §3): é
      // este callback do bootstrap que manda o evento pro renderer, e que
      // deriva `library:changed` sempre que algum item terminar em `done`
      // (docs/05 §4: "após cada item concluído, emite library:changed").
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.webContents.send(CH.importer.onProgress, state)
      if (state.items.some((item) => item.status === 'done')) {
        mainWindow.webContents.send(CH.importer.onLibraryChanged, 'import')
      }
    })

    // Boot passo 3 (docs/02-arquitetura.md §7): limpa cache/tmp e órfãos
    // antes de registrar o IPC e abrir a janela.
    const maintenanceService = new MaintenanceService(db, paths)
    await maintenanceService.run()

    registerComicProtocolHandler(paths, db, pageCacheService)
    registerAllIpc({
      settingsService,
      importService,
      libraryService,
      readerService,
      collectionService,
    })
    registerAppIpc(() => mainWindow, new StorageService(db, pageCacheService), {
      version: app.getVersion(),
      userDataPath: paths.root,
    })

    // Boot passo 4 (docs/02-arquitetura.md §7): libera espaço de cache em
    // segundo plano, sem atrasar a abertura da janela. Nada está aberto no
    // leitor ainda nesse momento, então não há HQ a preservar.
    void pageCacheService.enforceLru(null)

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const openWindow = (): void => {
      mainWindow = createMainWindow({
        initialBounds: settingsService.get()['window.bounds'],
        onBoundsChange: (bounds) => settingsService.update({ 'window.bounds': bounds }),
      })
      // docs/02-arquitetura.md §7: o progresso já está no main a cada `setPage`
      // recebido, então um crash do renderer só precisa do flush + reload.
      mainWindow.webContents.on('render-process-gone', () => {
        readerService.flush()
        mainWindow?.webContents.reload()
      })
      watchFullscreenChanges(mainWindow)
    }

    openWindow()

    app.on('activate', () => {
      // No Windows/Linux o app fecha com a última janela (ver window-all-closed
      // abaixo), então isto só é relevante se algo recriar o app sem sair.
      if (BrowserWindow.getAllWindows().length === 0) openWindow()
    })
  }

  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      // Uma falha aqui pode ocorrer antes do electron-log estar pronto
      // (initLogger roda dentro de bootstrap), então isto vai para o console.
      console.error('Falha ao inicializar o app:', error)
      app.quit()
    })

  app.on('window-all-closed', () => {
    // A v1 tem como alvo só o Windows (ADR-012): sempre sai com a última janela.
    app.quit()
  })

  app.on('before-quit', () => {
    // docs/02-arquitetura.md §7: grava o progresso pendente antes de fechar o banco.
    readerServiceRef?.flush()
  })

  // O banco só fecha em `will-quit`, depois de todas as janelas fecharem: o
  // handler de `close` da janela ainda grava os bounds (RF-61) e, com o banco
  // já fechado em `before-quit`, isso falhava com "database connection is not open".
  app.on('will-quit', () => {
    if (db) {
      closeDb(db)
      db = null
    }
  })
}
