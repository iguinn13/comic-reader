import { join } from 'path'
import { BrowserWindow, session, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { WindowBounds } from '@shared/types'
import icon from '../../resources/icon.png?asset'

// Fundo do app em docs/07-ui-ux.md §2.1 (--color-bg). Evita o flash branco
// entre `new BrowserWindow` e o primeiro paint do renderer.
const BACKGROUND_COLOR = '#0C0C0F'

// RF-61: janela mínima de 960×600.
const MIN_WIDTH = 960
const MIN_HEIGHT = 600
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

/** Tempo sem redimensionar/mover antes de persistir os bounds (evita gravar a cada pixel). */
const BOUNDS_SAVE_DEBOUNCE_MS = 500

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
    // `unsafe-inline` é necessário aqui porque o @vitejs/plugin-react injeta
    // um script inline de preamble do Fast Refresh no HTML servido em dev —
    // sem isso, a CSP bloqueia esse script e a página inteira quebra
    // ("can't detect preamble"). Não existe em build de produção (o preamble
    // é só do modo dev), então não afeta a CSP do app empacotado.
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

/** Aplica o mínimo de docs/03 §2.6, para bounds salvos antigos/corrompidos nunca abrirem menores que isso. */
function clampBounds(bounds: WindowBounds): WindowBounds {
  return {
    ...bounds,
    width: Math.max(bounds.width, MIN_WIDTH),
    height: Math.max(bounds.height, MIN_HEIGHT),
  }
}

export interface CreateMainWindowOptions {
  /** Bounds salvos da última sessão (RF-61); `null` na primeira execução. */
  initialBounds: WindowBounds | null
  /** Chamado (com debounce) a cada mudança de tamanho/posição e ao fechar. */
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
    // `icon` só precisa ser passado manualmente no Linux: Windows/macOS usam
    // o ícone do executável/bundle automaticamente (electron-builder cuida
    // disso no empacotamento); no Linux, sem isso a janela herda o ícone
    // genérico (ADR-021).
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

  // Checklist de segurança (docs/02-arquitetura.md §6): nenhuma janela nova
  // e nenhuma navegação para fora do app.
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

/**
 * RF-61: persiste tamanho, posição e estado maximizado. `getNormalBounds()`
 * devolve os bounds de quando a janela NÃO está maximizada/minimizada, que é
 * o que se quer restaurar depois — não os bounds "cheios" de uma janela
 * maximizada.
 */
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

/** Abre links externos (ex.: futuros itens de menu "Documentação") no navegador do sistema. */
export function openExternalLink(url: string): Promise<void> {
  return shell.openExternal(url)
}
