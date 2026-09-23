import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { mkdir } from 'fs/promises'
import { CH } from '@shared/channels'
import { closeDb, createDb, type Db } from './db/client'
import { registerAllIpc } from './ipc/register'
import { CoverService } from './services/cover-service'
import { ImportService } from './services/import-service'
import { MaintenanceService } from './services/maintenance-service'
import { SettingsService } from './services/settings-service'
import { initLogger, logger } from './utils/logger'
import { resizeToJpeg } from './utils/native-image-adapter'
import { createAppPaths } from './utils/paths'
import { createMainWindow } from './window'

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

  async function bootstrap(): Promise<void> {
    initLogger(paths)
    await Promise.all(paths.allDirectories.map((dir) => mkdir(dir, { recursive: true })))
    logger.info('Diretórios de dados prontos em', paths.root)

    electronApp.setAppUserModelId('com.comicreader.app')

    db = createDb(paths.dbFile)
    const settingsService = new SettingsService(db)

    let mainWindow: BrowserWindow | null = null

    const coverService = new CoverService(paths, resizeToJpeg)
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

    registerAllIpc({ settingsService, importService })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const openWindow = (): void => {
      mainWindow = createMainWindow({
        initialBounds: settingsService.get()['window.bounds'],
        onBoundsChange: (bounds) => settingsService.update({ 'window.bounds': bounds }),
      })
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
    // O ReaderService (M4) vai precisar dar flush no progresso pendente aqui
    // também; por enquanto só fecha a conexão com o banco de forma limpa.
    if (db) closeDb(db)
  })
}
