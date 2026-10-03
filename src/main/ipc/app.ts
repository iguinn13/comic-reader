import { shell, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import type { StorageService } from '../services/storage-service'
import { handle } from './handle'
export function registerAppIpc(
  getWindow: () => BrowserWindow | null,
  storage: StorageService,
  info: {
    version: string
    userDataPath: string
  },
): void {
  handle(CH.library.stats, z.tuple([]), () => storage.stats())
  handle(CH.app.info, z.tuple([]), () => info)
  handle(CH.app.clearCache, z.tuple([]), () => storage.clearCache())
  handle(CH.app.openDataFolder, z.tuple([]), async () => {
    await shell.openPath(info.userDataPath)
  })
  handle(CH.app.toggleFullscreen, z.tuple([z.boolean().optional()]), ([force]) => {
    const win = getWindow()
    if (!win) return false
    const next = force ?? !win.isFullScreen()
    win.setFullScreen(next)
    return next
  })
}
export function watchFullscreenChanges(window: BrowserWindow): void {
  const send = (isFullscreen: boolean): void => {
    if (!window.isDestroyed()) window.webContents.send(CH.app.onFullscreenChanged, isFullscreen)
  }
  window.on('enter-full-screen', () => {
    window.setAlwaysOnTop(true, 'screen-saver')
    send(true)
  })
  window.on('leave-full-screen', () => {
    window.setAlwaysOnTop(false)
    send(false)
  })
}
