import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { mkdir } from 'fs/promises'
import { createAppPaths } from './utils/paths'
import { initLogger, logger } from './utils/logger'
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

  async function bootstrap(): Promise<void> {
    initLogger(paths)
    await Promise.all(paths.allDirectories.map((dir) => mkdir(dir, { recursive: true })))
    logger.info('Diretórios de dados prontos em', paths.root)

    electronApp.setAppUserModelId('com.comicreader.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createMainWindow()

    app.on('activate', () => {
      // No Windows/Linux o app fecha com a última janela (ver window-all-closed
      // abaixo), então isto só é relevante se algo recriar o app sem sair.
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
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
}
