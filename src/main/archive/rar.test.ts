import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { RarArchive } from './rar'
const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')
const RAR4_FIXTURE = join(FIXTURES_DIR, 'simple-rar4.cbr')
const RAR5_FIXTURE = join(FIXTURES_DIR, 'simple-rar5.cbr')
describe('RarArchive', () => {
  it('implementa a interface ComicArchive (listPages, readPage, extractAll, close)', () => {
    expect(typeof RarArchive.open).toBe('function')
    const proto = RarArchive.prototype as unknown as Record<string, unknown>
    expect(typeof proto.listPages).toBe('function')
    expect(typeof proto.readPage).toBe('function')
    expect(typeof proto.extractAll).toBe('function')
    expect(typeof proto.close).toBe('function')
  })
  it('rejeita um buffer que não é um RAR de verdade', async () => {
    await expect(RarArchive.open(Buffer.from('não é um rar'))).rejects.toThrow()
  })
  it.skipIf(!existsSync(RAR4_FIXTURE))('lê as 3 páginas de simple-rar4.cbr (RAR4)', async () => {
    const archive = await RarArchive.open(readFileSync(RAR4_FIXTURE))
    const pages = await archive.listPages()
    expect(pages).toHaveLength(3)
    await archive.close()
  })
  it.skipIf(!existsSync(RAR5_FIXTURE))('lê as 3 páginas de simple-rar5.cbr (RAR5)', async () => {
    const archive = await RarArchive.open(readFileSync(RAR5_FIXTURE))
    const pages = await archive.listPages()
    expect(pages).toHaveLength(3)
    await archive.close()
  })
})
