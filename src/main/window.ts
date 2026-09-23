import { join } from 'path'
import { BrowserWindow, session, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Fundo do app em docs/07-ui-ux.md §2.1 (--color-bg). Evita o flash branco
// entre `new BrowserWindow` e o primeiro paint do renderer.
const BACKGROUND_COLOR = '#0C0C0F'

/**
 * Política de segurança de conteúdo aplicada via cabeçalho HTTP (em vez de
 * <meta> no index.html), para poder relaxar só o necessário em desenvolvimento
 * sem duplicar a política em dois lugares. Ver docs/02-arquitetura.md §6.
 *
 * `comic:` ainda não está registrado (chega em M3 — protocolo comic://), mas
 * já entra aqui para não precisar tocar nesta política de novo naquele
 * milestone.
 */
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
    // O servidor de dev do electron-vite roda em http(s)://localhost com HMR
    // por WebSocket. Fora de dev, o renderer é carregado como arquivo local.
    directives['script-src'].push("'unsafe-eval'")
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

export function createMainWindow(): BrowserWindow {
  applyContentSecurityPolicy()

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Checklist de segurança (docs/02-arquitetura.md §6): nenhuma janela nova
  // e nenhuma navegação para fora do app.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/** Abre links externos (ex.: futuros itens de menu "Documentação") no navegador do sistema. */
export function openExternalLink(url: string): Promise<void> {
  return shell.openExternal(url)
}
