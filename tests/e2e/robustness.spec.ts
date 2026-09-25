import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'
import { FIXTURES, cleanup, importFixture, launch } from './app'

type Api = { api: Record<string, any> }

/** Sem `app.close()`: simula queda do processo (RNF-05, RNF-12). */
function kill(app: Awaited<ReturnType<typeof launch>>['app']): Promise<void> {
  const proc = app.process()
  return new Promise((resolve) => {
    proc.once('exit', () => resolve())
    proc.kill('SIGKILL')
  })
}

test('matar o app durante a leitura perde no máximo o debounce do progresso', async () => {
  const first = await launch()
  const comicId = await importFixture(first.page, 'simple.cbz')
  await first.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(first.page.getByText('1 / 5')).toBeVisible()
  for (let i = 0; i < 3; i++) await first.page.keyboard.press('ArrowRight')
  await expect(first.page.getByText('4 / 5')).toBeVisible()
  // Espera o debounce de 500 ms do main gravar (docs ADR-010) e derruba o processo.
  await first.page.waitForTimeout(1200)
  await kill(first.app)

  const second = await launch(first.userData)
  const page = await second.page.evaluate(
    async (id) => (await (window as unknown as Api).api.library.get(id)).data.currentPage,
    comicId,
  )
  expect(page).toBe(3)
  await second.app.close()
  cleanup(first.userData)
})

test('matar o app durante a importação deixa a biblioteca consistente ao reabrir', async () => {
  const first = await launch()
  await first.page.evaluate(
    async (paths) => (window as unknown as Api).api.importer.start(paths),
    ['pack.zip', 'simple.cbz', 'wide-page.cbz', 'natural-order.cbz'].map((f) => join(FIXTURES, f)),
  )
  await kill(first.app)

  const second = await launch(first.userData)
  const items: { id: string; fileName?: string }[] = await second.page.evaluate(async () => {
    const result = await (window as unknown as Api).api.library.list({
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 100,
      offset: 0,
    })
    return result.data.items
  })

  const libraryDir = join(second.userData, 'library')
  const files = existsSync(libraryDir) ? readdirSync(libraryDir) : []
  // Toda HQ registrada tem o arquivo, e todo arquivo em library/ tem registro (sem órfãos).
  for (const item of items) expect(files.some((name) => name.startsWith(item.id))).toBe(true)
  for (const name of files) expect(items.some((item) => name.startsWith(item.id))).toBe(true)
  const tmpDir = join(second.userData, 'cache', 'tmp')
  expect(existsSync(tmpDir) ? readdirSync(tmpDir) : []).toEqual([])

  await second.app.close()
  cleanup(first.userData)
})
