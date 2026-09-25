import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export const FIXTURES = join(__dirname, '..', 'fixtures')

export interface Launched {
  app: ElectronApplication
  page: Page
  userData: string
  consoleErrors: string[]
}

/** Abre o app buildado com um `userData` temporário (ou o informado, para "reabrir"). */
export async function launch(userData = mkdtempSync(join(tmpdir(), 'comic-reader-e2e-'))): Promise<Launched> {
  // `ELECTRON_RUN_AS_NODE` (herdado de terminais do VS Code) faria o Electron rodar como Node puro.
  const env = { ...process.env, COMIC_READER_USER_DATA: userData } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE

  const app = await electron.launch({ args: ['.', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], env })
  const page = await app.firstWindow()
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.waitForSelector('#root nav')
  return { app, page, userData, consoleErrors }
}

export function cleanup(userData: string): void {
  rmSync(userData, { recursive: true, force: true })
}

/** Importa um arquivo de `tests/fixtures` pelo IPC (sem o diálogo do SO) e espera terminar. */
export async function importFixture(page: Page, fileName: string): Promise<string> {
  const path = join(FIXTURES, fileName)
  return page.evaluate(async (filePath) => {
    const api = (window as unknown as { api: Record<string, any> }).api
    await api.importer.start([filePath])
    for (let i = 0; i < 100; i++) {
      const job = (await api.importer.getJob()).data
      if (job && job.status !== 'running') return job.items[0].comicId as string
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('importação não terminou')
  }, path)
}
