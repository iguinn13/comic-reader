import { existsSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'
import { addFixtureToLibrary, cleanup, launch } from './app'

test('adicionar pasta e ler: avança 3 páginas, reabre e volta na página 4', async () => {
  const first = await launch()
  const comicId = await addFixtureToLibrary(first.page, first.comicsDir, 'simple.cbz')

  await first.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(first.page.getByText('1 / 5')).toBeVisible()
  for (let i = 0; i < 3; i++) await first.page.keyboard.press('ArrowRight')
  await expect(first.page.getByText('4 / 5')).toBeVisible()
  // Sai do leitor (flush do progresso) e fecha o app.
  await first.page.keyboard.press('Backspace')
  await first.app.close()

  const second = await launch(first.userData, first.comicsDir)
  await second.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(second.page.getByText('4 / 5')).toBeVisible()
  await second.app.close()
  cleanup(first.userData, first.comicsDir)
})

test('modos: alterna os 3 modos na mesma HQ sem erros no console', async () => {
  const { app, page, userData, comicsDir, consoleErrors } = await launch()
  const comicId = await addFixtureToLibrary(page, comicsDir, 'simple.cbz')
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
  expect(consoleErrors.filter((message) => !message.includes('Electron Security Warning'))).toEqual(
    [],
  )
  await app.close()
  cleanup(userData, comicsDir)
})

test('próximo arquivo da pasta: painel de fim sugere a HQ seguinte em ordem natural', async () => {
  const { app, page, userData, comicsDir } = await launch()
  // Nomes que só ordenam corretamente em ordem natural, não lexicográfica.
  const a = await addFixtureToLibrary(page, comicsDir, 'simple.cbz')
  await addFixtureToLibrary(page, comicsDir, 'wide-page.cbz')

  await page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, a)
  await expect(page.getByText('1 / 5')).toBeVisible()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText('Próximo arquivo desta pasta')).toBeVisible()
  await app.close()
  cleanup(userData, comicsDir)
})

test('exclusão: sem apagar o arquivo, a HQ some da biblioteca mas o arquivo continua na pasta', async () => {
  const { app, page, userData, comicsDir } = await launch()
  const comicId = await addFixtureToLibrary(page, comicsDir, 'simple.cbz')
  const filePath = join(comicsDir, 'simple.cbz')
  expect(existsSync(filePath)).toBe(true)

  await page.evaluate(
    (id) => (window as unknown as { api: any }).api.library.delete([id], { deleteFile: false }),
    comicId,
  )
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
  expect(existsSync(filePath)).toBe(true)
  await app.close()
  cleanup(userData, comicsDir)
})

test('exclusão com apagar arquivo: a HQ e o arquivo somem juntos', async () => {
  const { app, page, userData, comicsDir } = await launch()
  const comicId = await addFixtureToLibrary(page, comicsDir, 'simple.cbz')
  const filePath = join(comicsDir, 'simple.cbz')

  await page.evaluate(
    (id) => (window as unknown as { api: any }).api.library.delete([id], { deleteFile: true }),
    comicId,
  )
  expect(existsSync(filePath)).toBe(false)
  await app.close()
  cleanup(userData, comicsDir)
})
