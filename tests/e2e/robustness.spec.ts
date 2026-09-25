import { copyFileSync } from 'fs'
import { join } from 'path'
import { expect, test } from '@playwright/test'
import { FIXTURES, addFixtureToLibrary, cleanup, launch } from './app'

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
  const comicId = await addFixtureToLibrary(first.page, first.comicsDir, 'simple.cbz')
  await first.page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(first.page.getByText('1 / 5')).toBeVisible()
  for (let i = 0; i < 3; i++) await first.page.keyboard.press('ArrowRight')
  await expect(first.page.getByText('4 / 5')).toBeVisible()
  // Espera o debounce de 500 ms do main gravar (docs ADR-010) e derruba o processo.
  await first.page.waitForTimeout(1200)
  await kill(first.app)

  const second = await launch(first.userData, first.comicsDir)
  const page = await second.page.evaluate(
    async (id) => (await (window as unknown as Api).api.library.get(id)).data.currentPage,
    comicId,
  )
  expect(page).toBe(3)
  await second.app.close()
  cleanup(first.userData, first.comicsDir)
})

test('matar o app no meio do scan deixa a biblioteca consistente ao reabrir', async () => {
  const first = await launch()
  for (const name of ['simple.cbz', 'wide-page.cbz', 'natural-order.cbz']) {
    copyFileSync(join(FIXTURES, name), join(first.comicsDir, name))
  }
  // Dispara o scan sem esperar terminar, e derruba o processo logo em seguida
  // — cada HQ só entra no banco numa transação própria (docs/03 §4), então o
  // pior caso é algumas HQs ainda não escaneadas, nunca um registro parcial.
  void first.page.evaluate(async () => {
    await (window as unknown as Api).api.libraryFolders.add()
  })
  await first.page.waitForTimeout(50)
  await kill(first.app)

  // O scan automático do boot (docs/02 §7) termina o trabalho na reabertura.
  const second = await launch(first.userData, first.comicsDir)
  await expect
    .poll(async () => {
      const result = await second.page.evaluate(
        async () =>
          (
            await (window as unknown as Api).api.library.list({
              sort: 'createdAt',
              order: 'desc',
              status: 'all',
              favoritesOnly: false,
              limit: 100,
              offset: 0,
            })
          ).data.total,
      )
      return result
    })
    .toBe(3)

  await second.app.close()
  cleanup(first.userData, first.comicsDir)
})
