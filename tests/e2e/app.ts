import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'

export const FIXTURES = join(__dirname, '..', 'fixtures')

export interface Launched {
  app: ElectronApplication
  page: Page
  userData: string
  comicsDir: string
  consoleErrors: string[]
}

/** Abre o app buildado com um `userData` temporário (ou o informado, para "reabrir"). */
export async function launch(
  userData = mkdtempSync(join(tmpdir(), 'comic-reader-e2e-')),
  comicsDir = mkdtempSync(join(tmpdir(), 'comic-reader-e2e-comics-')),
): Promise<Launched> {
  // `ELECTRON_RUN_AS_NODE` (herdado de terminais do VS Code) faria o Electron rodar como Node puro.
  const env = {
    ...process.env,
    COMIC_READER_USER_DATA: userData,
    // Sem cabeça de vidro pra automatizar o diálogo do SO (docs/09 §2.3): os
    // testes apontam `libraryFolders.add()` direto pra esta pasta.
    COMIC_READER_E2E: '1',
    COMIC_READER_E2E_FOLDER: comicsDir,
  } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE

  const app = await electron.launch({
    args: ['.', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env,
  })
  const page = await app.firstWindow()
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.waitForSelector('#root nav')
  return { app, page, userData, comicsDir, consoleErrors }
}

export function cleanup(userData: string, comicsDir?: string): void {
  rmSync(userData, { recursive: true, force: true })
  if (comicsDir) rmSync(comicsDir, { recursive: true, force: true })
}

async function listComicIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const api = (window as unknown as { api: Record<string, any> }).api
    const result = await api.library.list({
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 500,
      offset: 0,
    })
    return result.data.items.map((item: { id: string }) => item.id) as string[]
  })
}

/** Garante que a pasta-raiz de teste (`comicsDir`) está registrada — idempotente. */
export async function addLibraryFolder(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const api = (window as unknown as { api: Record<string, any> }).api
    await api.libraryFolders.add()
  })
}

/**
 * Copia um arquivo de `tests/fixtures` para a pasta-raiz da biblioteca do
 * teste e escaneia, sem o diálogo do SO (docs/05-importacao.md). Devolve o id
 * da HQ resultante.
 */
export async function addFixtureToLibrary(
  page: Page,
  comicsDir: string,
  fileName: string,
): Promise<string> {
  mkdirSync(comicsDir, { recursive: true })
  copyFileSync(join(FIXTURES, fileName), join(comicsDir, basename(fileName)))

  await addLibraryFolder(page)
  const before = new Set(await listComicIds(page))
  await page.evaluate(async () => {
    const api = (window as unknown as { api: Record<string, any> }).api
    await api.library.scan()
  })
  const after = await listComicIds(page)
  const added = after.find((id) => !before.has(id))
  if (!added) throw new Error(`scan não indexou "${fileName}"`)
  return added
}
