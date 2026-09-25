import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'
import { cleanup, importFixture, launch } from './app'

test('importar e ler: avança 3 páginas, reabre e volta na página 4', async () => {
  const first = await launch()
  const comicId = await importFixture(first.page, 'simple.cbz')

  await first.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(first.page.getByText('1 / 5')).toBeVisible()
  for (let i = 0; i < 3; i++) await first.page.keyboard.press('ArrowRight')
  await expect(first.page.getByText('4 / 5')).toBeVisible()
  // Sai do leitor (flush do progresso) e fecha o app.
  await first.page.keyboard.press('Backspace')
  await first.app.close()

  const second = await launch(first.userData)
  await second.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(second.page.getByText('4 / 5')).toBeVisible()
  await second.app.close()
  cleanup(first.userData)
})

test('modos: alterna os 3 modos na mesma HQ sem erros no console', async () => {
  const { app, page, userData, consoleErrors } = await launch()
  const comicId = await importFixture(page, 'simple.cbz')
  await page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(page.getByText('1 / 5')).toBeVisible()

  const modes = { '2': 'Página dupla', '3': 'Vertical', '1': 'Página única' }
  for (const [key, title] of Object.entries(modes)) {
    await page.keyboard.press(key)
    await expect(page.getByTitle(title)).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(300)
  }
  expect(consoleErrors.filter((message) => !message.includes('Electron Security Warning'))).toEqual([])
  await app.close()
  cleanup(userData)
})

test('saga: cria, reordena e o painel de fim sugere a próxima', async () => {
  const { app, page, userData } = await launch()
  const a = await importFixture(page, 'simple.cbz')
  const b = await importFixture(page, 'wide-page.cbz')

  const sagaId = await page.evaluate(
    async ([x, y]) => {
      const api = (window as unknown as { api: Record<string, any> }).api
      const saga = (await api.collections.create({ type: 'saga', name: 'Saga E2E', comicIds: [x, y] })).data
      await api.collections.reorder(saga.id, [y, x])
      await api.collections.reorder(saga.id, [x, y])
      return saga.id as string
    },
    [a, b],
  )

  await page.evaluate(
    ([id, saga]) => {
      window.location.hash = `#/read/${id}?from=${saga}`
    },
    [a, sagaId],
  )
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Próxima na saga')).toBeVisible()
  await app.close()
  cleanup(userData)
})

test('exclusão: a HQ some da biblioteca e o arquivo some de library/', async () => {
  const { app, page, userData } = await launch()
  const comicId = await importFixture(page, 'simple.cbz')
  const libraryDir = join(userData, 'library')
  expect(readdirSync(libraryDir).some((name) => name.startsWith(comicId))).toBe(true)

  await page.evaluate((id) => (window as unknown as { api: any }).api.library.delete([id]), comicId)
  await expect
    .poll(() => existsSync(libraryDir) && readdirSync(libraryDir).some((name) => name.startsWith(comicId)))
    .toBe(false)
  const total = await page.evaluate(
    async () =>
      (
        await (window as unknown as { api: any }).api.library.list({
          sort: 'createdAt',
          order: 'desc',
          status: 'all',
          favoritesOnly: false,
          limit: 10,
          offset: 0,
        })
      ).data.total,
  )
  expect(total).toBe(0)
  await app.close()
  cleanup(userData)
})
