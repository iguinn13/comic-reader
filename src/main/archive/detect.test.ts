import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { detectFormat } from './detect'

const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')

describe('detectFormat', () => {
  it('reconhece um ZIP pelos magic bytes', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'simple.cbz'))
    expect(detectFormat(buffer)).toBe('zip')
  })

  it('reconhece um PDF pelos magic bytes', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'simple.pdf'))
    expect(detectFormat(buffer)).toBe('pdf')
  })

  it('reconhece um .cbr que na verdade é ZIP como zip', () => {
    const buffer = readFileSync(join(FIXTURES_DIR, 'zip-as-cbr.cbr'))
    expect(detectFormat(buffer)).toBe('zip')
  })

  it('devolve "unknown" para bytes aleatórios', () => {
    expect(detectFormat(Buffer.from('não é um arquivo compactado'))).toBe('unknown')
  })

  it('devolve "unknown" para buffer vazio ou curto demais', () => {
    expect(detectFormat(Buffer.alloc(0))).toBe('unknown')
    expect(detectFormat(Buffer.from([0x50, 0x4b]))).toBe('unknown')
  })
})
