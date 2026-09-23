import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { CoverService } from './cover-service'

let root: string
let paths: AppPaths

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-cover-'))
  paths = createAppPaths(root)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('CoverService.generateComicCover', () => {
  it('devolve null sem tentar nada quando firstPageBuffer é null (caso PDF)', async () => {
    const service = new CoverService(paths, (buf) => buf)
    const result = await service.generateComicCover('comic-1', null)
    expect(result).toBeNull()
    expect(existsSync(paths.comicCoverFile('comic-1'))).toBe(false)
  })

  it('grava o JPEG no caminho certo e devolve coverVersion 1', async () => {
    const fakeJpeg = Buffer.from('fake-jpeg-content')
    const service = new CoverService(paths, (buf) => buf)

    const result = await service.generateComicCover('comic-2', fakeJpeg)

    expect(result).toEqual({ coverVersion: 1 })
    const destFile = paths.comicCoverFile('comic-2')
    expect(existsSync(destFile)).toBe(true)
    expect(readFileSync(destFile)).toEqual(fakeJpeg)
  })

  it('devolve null e não lança quando o resize (injetado) lança', async () => {
    const service = new CoverService(paths, () => {
      throw new Error('falha simulada de resize')
    })

    const result = await service.generateComicCover('comic-3', Buffer.from('x'))

    expect(result).toBeNull()
    expect(existsSync(paths.comicCoverFile('comic-3'))).toBe(false)
  })
})
