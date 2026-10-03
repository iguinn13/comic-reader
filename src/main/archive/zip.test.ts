import { readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ZipArchive } from './zip'
const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')
function loadFixture(name: string): Buffer {
  return readFileSync(join(FIXTURES_DIR, name))
}
let openArchives: ZipArchive[] = []
async function open(name: string): Promise<ZipArchive> {
  const archive = await ZipArchive.open(loadFixture(name))
  openArchives.push(archive)
  return archive
}
afterEach(async () => {
  await Promise.all(openArchives.map((a) => a.close()))
  openArchives = []
})
describe('ZipArchive', () => {
  it('lista as 5 páginas de simple.cbz em ordem', async () => {
    const archive = await open('simple.cbz')
    const pages = await archive.listPages()
    expect(pages.map((p) => p.entryName)).toEqual([
      '01.jpg',
      '02.jpg',
      '03.jpg',
      '04.jpg',
      '05.jpg',
    ])
    expect(pages.map((p) => p.index)).toEqual([0, 1, 2, 3, 4])
  })
  it('ordena natural-order.cbz e ignora __MACOSX/Thumbs.db', async () => {
    const archive = await open('natural-order.cbz')
    const pages = await archive.listPages()
    expect(pages.map((p) => p.entryName)).toEqual(['1.jpg', '2.jpg', '10.jpg', '11.jpg'])
  })
  it('respeita as subpastas em nested-folders.cbz', async () => {
    const archive = await open('nested-folders.cbz')
    const pages = await archive.listPages()
    expect(pages.map((p) => p.entryName)).toEqual(['cap1/1.jpg', 'cap1/2.jpg', 'cap2/1.jpg'])
  })
  it('lista as páginas de wide-page.cbz', async () => {
    const archive = await open('wide-page.cbz')
    const pages = await archive.listPages()
    expect(pages).toHaveLength(6)
  })
  it('lê o conteúdo de uma página', async () => {
    const archive = await open('simple.cbz')
    const content = await archive.readPage('01.jpg')
    expect(content.length).toBeGreaterThan(0)
    expect(content[0]).toBe(0x89)
    expect(content[1]).toBe(0x50)
  })
  it('trata um .cbr que na verdade é ZIP normalmente', async () => {
    const archive = await open('zip-as-cbr.cbr')
    const pages = await archive.listPages()
    expect(pages.length).toBeGreaterThan(0)
  })
  it('no-images.cbz não tem páginas (só ComicInfo.xml)', async () => {
    const archive = await open('no-images.cbz')
    const pages = await archive.listPages()
    expect(pages).toHaveLength(0)
  })
  it('rejeita um ZIP corrompido/truncado', async () => {
    await expect(ZipArchive.open(loadFixture('corrupted.cbz'))).rejects.toThrow()
  })
})
