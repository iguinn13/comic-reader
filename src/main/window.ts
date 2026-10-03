import { join } from 'path'
import { BrowserWindow, session, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { WindowBounds } from '@shared/types'
import icon from '../../resources/icon.png?asset'
const BACKGROUND_COLOR = '#0C0C0F'
const MIN_WIDTH = 960
const MIN_HEIGHT = 600
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800
const BOUNDS_SAVE_DEBOUNCE_MS = 500
function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'comic:', 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'comic:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
  }
  if (is.dev) {
    directives['script-src'].push("'unsafe-eval'", "'unsafe-inline'")
    directives['connect-src'].push('ws://localhost:*', 'http://localhost:*')
  }
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}
function applyContentSecurityPolicy(): void {
  const csp = buildContentSecurityPolicy()
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}
function clampBounds(bounds: WindowBounds): WindowBounds {
  return {
    ...bounds,
    width: Math.max(bounds.width, MIN_WIDTH),
    height: Math.max(bounds.height, MIN_HEIGHT),
  }
}
export interface CreateMainWindowOptions {
  initialBounds: WindowBounds | null
  onBoundsChange: (bounds: WindowBounds) => void
}
export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  applyContentSecurityPolicy()
  const bounds = options.initialBounds ? clampBounds(options.initialBounds) : null
  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? DEFAULT_WIDTH,
    height: bounds?.height ?? DEFAULT_HEIGHT,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: BACKGROUND_COLOR,
      symbolColor: '#ECECEF',
      height: 40,
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })
  if (bounds?.maximized) {
    mainWindow.maximize()
  }
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
    }
  })
  setUpBoundsPersistence(mainWindow, options.onBoundsChange)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}
function setUpBoundsPersistence(
  window: BrowserWindow,
  onBoundsChange: (bounds: WindowBounds) => void,
): void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const captureBounds = (): WindowBounds => {
    const normal = window.getNormalBounds()
    return { ...normal, maximized: window.isMaximized() }
  }
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!window.isDestroyed()) onBoundsChange(captureBounds())
    }, BOUNDS_SAVE_DEBOUNCE_MS)
  }
  window.on('resize', scheduleSave)
  window.on('move', scheduleSave)
  window.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer)
    onBoundsChange(captureBounds())
  })
}
export function openExternalLink(url: string): Promise<void> {
  return shell.openExternal(url)
}
