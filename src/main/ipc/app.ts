import { shell, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import type { StorageService } from '../services/storage-service'
import { handle } from './handle'

/**
 * Domínio `app`: tela cheia (RF-37, só alterna `BrowserWindow.setFullScreen`),
 * e as ações de Configurações (RF-51..53): estatísticas, limpar cache, abrir
 * a pasta de dados e "Sobre". `openPath` é adaptador do SO, não regra de negócio.
 */
export function registerAppIpc(
  getWindow: () => BrowserWindow | null,
  storage: StorageService,
  info: { version: string; userDataPath: string },
): void {
  handle(CH.library.stats, z.tuple([]), () => storage.stats())
  handle(CH.app.info, z.tuple([]), () => info)
  handle(CH.app.clearCache, z.tuple([]), () => storage.clearCache())
  handle(CH.app.openDataFolder, z.tuple([]), async () => {
    await shell.openPath(info.userDataPath)
  })

  // `force` torna a chamada idempotente (ex.: entrar em tela cheia ao abrir o leitor).
  handle(CH.app.toggleFullscreen, z.tuple([z.boolean().optional()]), ([force]) => {
    const win = getWindow()
    if (!win) return false
    const next = force ?? !win.isFullScreen()
    win.setFullScreen(next)
    return next
  })
}

/**
 * O usuário pode sair da tela cheia por fora do app (Esc do SO, botão da
 * janela), então o renderer precisa ouvir a mudança em vez de só confiar no
 * retorno de `toggleFullscreen` (docs/06-leitor.md §6).
 */
export function watchFullscreenChanges(window: BrowserWindow): void {
  const send = (isFullscreen: boolean): void => {
    if (!window.isDestroyed()) window.webContents.send(CH.app.onFullscreenChanged, isFullscreen)
  }
  // No Windows, com `titleBarStyle: 'hidden'` (e maximizada), a barra de tarefas
  // pode continuar por cima da tela cheia. Manter a janela acima dela (como o F11
  // do Chrome) garante que a barra de tarefas some.
  window.on('enter-full-screen', () => {
    window.setAlwaysOnTop(true, 'screen-saver')
    send(true)
  })
  window.on('leave-full-screen', () => {
    window.setAlwaysOnTop(false)
    send(false)
  })
}
