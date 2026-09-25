import { copyFileSync } from 'fs'
import { basename, join } from 'path'
import { expect, test } from '@playwright/test'
import { makeBigComic } from './big-comic'
import { cleanup, launch } from './app'

/**
 * RNF-03: renderer < 600 MB lendo uma HQ de 300 páginas no modo vertical.
 * Pesado (gera 300 PNGs e rola tudo): só roda com `E2E_MEMORY=1`.
 */
test.skip(!process.env['E2E_MEMORY'], 'defina E2E_MEMORY=1 para rodar')
test('HQ de 300 páginas no vertical usa < 600 MB no renderer', async () => {
  test.setTimeout(240_000)
  const file = await makeBigComic(300)
  const { app, page, userData, comicsDir } = await launch()

  copyFileSync(file, join(comicsDir, basename(file)))
  const comicId: string = await page.evaluate(async () => {
    const api = (window as unknown as { api: Record<string, any> }).api
    await api.libraryFolders.add()
    const list = await api.library.list({
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 1,
      offset: 0,
    })
    const comic = list.data.items[0]
    if (!comic) throw new Error('scan não indexou a HQ grande')
    return comic.id as string
  })

  await page.evaluate((id) => {
    window.location.hash = `#/read/${id}`
  }, comicId)
  await expect(page.getByText('1 / 300')).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('3')
  await expect(page.getByTitle('Vertical')).toHaveAttribute('aria-pressed', 'true')

  await page.waitForTimeout(2000)
  const tabMb = (): Promise<number> =>
    app.evaluate(
      ({ app: a }) =>
        Math.max(
          ...a
            .getAppMetrics()
            .filter((m) => m.type === 'Tab')
            .map((m) => m.memory.workingSetSize),
        ) / 1024,
    )

  // Rola a HQ inteira, passo a passo, como quem lê até o fim; devolve o quanto percorreu (0..1).
  const scroller = page.locator('div.overflow-auto.bg-reader-bg').first()
  const scrollUntil = (limit: number): Promise<number> =>
    scroller.evaluate(async (el, max) => {
      for (let guard = 0; guard < 2000; guard++) {
        const before = el.scrollTop
        if ((el.scrollTop + el.clientHeight) / el.scrollHeight >= max) break
        el.scrollTop += el.clientHeight * 0.8
        await new Promise((resolve) => setTimeout(resolve, 40))
        if (el.scrollTop === before) break
      }
      return (el.scrollTop + el.clientHeight) / el.scrollHeight
    }, limit)

  // A medição só vale se a HQ foi percorrida de fato.
  expect(await scrollUntil(0.5)).toBeGreaterThan(0.45)
  await page.waitForTimeout(2000)
  const midMb = await tabMb()
  expect(await scrollUntil(1)).toBeGreaterThan(0.99)
  await page.waitForTimeout(2000)
  const endMb = await tabMb()
  console.log(`[RNF-03] renderer: ${midMb.toFixed(0)} MB na metade, ${endMb.toFixed(0)} MB no fim`)

  // Sem vazamento: percorrer a segunda metade não pode inflar o processo (o cache do Chromium tem teto).
  expect(endMb).toBeLessThan(midMb * 1.25)
  // O teto absoluto vale no Windows (GPU); no Linux sem GPU o raster por software infla o processo.
  if (process.platform === 'win32') expect(endMb).toBeLessThan(600)

  await app.close()
  cleanup(userData, comicsDir)
})
