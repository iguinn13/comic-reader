import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import { createDb, type Db } from '../db/client'
import { insertComic, type InsertComicInput } from '../db/repositories/comics'
import { insertLibraryFolder } from '../db/repositories/library-folders'
import { setCurrentPage } from '../db/repositories/progress'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { LibraryService } from './library-service'

let db: Db
let service: LibraryService
let root: string
let folderId: string
let paths: AppPaths

function makeInput(overrides: Partial<InsertComicInput> = {}): InsertComicInput {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    title: 'Batman - Ano Um 01',
    titleNormalized: 'batman - ano um 01',
    format: 'zip',
    filePath: join(root, `Batman_-_Ano_Um_01-${id}.cbz`),
    dirPath: root,
    folderId,
    originalFileName: 'Batman_-_Ano_Um_01.cbz',
    fileSize: 1024,
    fileHash: `hash-${id}`,
    pageCount: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
    ...overrides,
  }
}

beforeEach(() => {
  db = createDb(':memory:')
  root = mkdtempSync(join(tmpdir(), 'comic-reader-library-'))
  paths = createAppPaths(root)
  folderId = randomUUID()
  insertLibraryFolder(db, { id: folderId, path: root })
  service = new LibraryService(db, paths)
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('LibraryService.get/list', () => {
  it('lança NOT_FOUND para um id inexistente', () => {
    expect(() => service.get(randomUUID())).toThrowError(AppError)
  })

  it('coverUrl é null com coverVersion 0 (capa ainda não gerada)', () => {
    const input = makeInput()
    insertComic(db, input)

    const detail = service.get(input.id)
    expect(detail.coverUrl).toBeNull()
  })

  it('coverUrl aponta pra comic://cover/comic/{id}?v={coverVersion}', () => {
    const input = makeInput({ coverVersion: 3 })
    insertComic(db, input)

    const detail = service.get(input.id)
    expect(detail.coverUrl).toBe(`comic://cover/comic/${input.id}?v=3`)
  })

  it('calcula progress como (currentPage+1)/pageCount enquanto não está lida', () => {
    const input = makeInput({ pageCount: 4 })
    insertComic(db, input)
    setCurrentPage(db, input.id, 1)

    const { items } = service.list({
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 10,
      offset: 0,
    })

    expect(items[0]?.progress).toBe(0.5)
  })
})

describe('LibraryService.setFavorite/setReadStatus/delete', () => {
  it('favorita e remove o favorito por lote', () => {
    const a = makeInput()
    const b = makeInput()
    insertComic(db, a)
    insertComic(db, b)

    service.setFavorite([a.id, b.id], true)
    expect(service.get(a.id).isFavorite).toBe(true)
    expect(service.get(b.id).isFavorite).toBe(true)

    service.setFavorite([a.id], false)
    expect(service.get(a.id).isFavorite).toBe(false)
    expect(service.get(b.id).isFavorite).toBe(true)
  })

  it('marca como lida e depois como não lida', () => {
    const input = makeInput()
    insertComic(db, input)

    service.setReadStatus([input.id], 'read')
    expect(service.get(input.id).status).toBe('read')
    expect(service.get(input.id).progress).toBe(1)

    service.setReadStatus([input.id], 'unread')
    expect(service.get(input.id).status).toBe('unread')
    expect(service.get(input.id).currentPage).toBe(0)
  })

  it('exclui e devolve a contagem de excluídas', async () => {
    const input = makeInput()
    insertComic(db, input)

    expect(await service.delete([input.id], { deleteFile: false })).toEqual({ deleted: 1 })
    expect(() => service.get(input.id)).toThrowError(AppError)
  })

  it('sem deleteFile: apaga a capa e o cache, mas nunca o arquivo original', async () => {
    const input = makeInput()
    insertComic(db, input)
    mkdirSync(paths.coversComicsDir, { recursive: true })
    mkdirSync(paths.comicPagesCacheDir(input.id), { recursive: true })
    writeFileSync(input.filePath, 'x')
    writeFileSync(paths.comicCoverFile(input.id), 'x')

    await service.delete([input.id], { deleteFile: false })

    expect(existsSync(input.filePath)).toBe(true)
    expect(existsSync(paths.comicCoverFile(input.id))).toBe(false)
    expect(existsSync(paths.comicPagesCacheDir(input.id))).toBe(false)
  })

  it('com deleteFile: apaga também o arquivo, pois ele está numa pasta configurada', async () => {
    const input = makeInput()
    insertComic(db, input)
    writeFileSync(input.filePath, 'x')

    await service.delete([input.id], { deleteFile: true })

    expect(existsSync(input.filePath)).toBe(false)
  })

  it('com deleteFile: nunca apaga um arquivo fora de qualquer pasta configurada', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'comic-reader-outside-'))
    const input = makeInput({
      filePath: join(outsideDir, 'fora.cbz'),
      dirPath: outsideDir,
    })
    insertComic(db, input)
    writeFileSync(input.filePath, 'x')

    try {
      await service.delete([input.id], { deleteFile: true })
      expect(existsSync(input.filePath)).toBe(true)
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })
})

describe('LibraryService.browseFolder', () => {
  it('sem folderId, lista as pastas-raiz configuradas como subpastas do nível-topo', () => {
    const contents = service.browseFolder({ folderId: null, relativePath: '' })
    expect(contents.subfolders).toEqual([
      {
        name: basename(root),
        folderId,
        relativePath: '',
        comicCount: 0,
        coverUrl: null,
        hasDirectComics: false,
      },
    ])
    expect(contents.comics).toEqual([])
  })

  it('agrupa HQs em subpastas pelo primeiro segmento relativo, e HQs soltas ficam direto no nível', () => {
    const direct = makeInput({ filePath: join(root, 'solta.cbz') })
    const nested1 = makeInput({ filePath: join(root, 'DC', 'Ano Um', '01.cbz') })
    const nested2 = makeInput({ filePath: join(root, 'DC', 'Ano Um', '02.cbz') })
    const nested3 = makeInput({ filePath: join(root, 'DC', 'Elseworlds', '01.cbz') })
    insertComic(db, direct)
    insertComic(db, nested1)
    insertComic(db, nested2)
    insertComic(db, nested3)

    const top = service.browseFolder({ folderId, relativePath: '' })
    expect(top.comics.map((c) => c.id)).toEqual([direct.id])
    expect(top.subfolders).toEqual([
      {
        name: 'DC',
        folderId,
        relativePath: 'DC',
        comicCount: 3,
        coverUrl: null,
        hasDirectComics: false,
      },
    ])

    const insideDC = service.browseFolder({ folderId, relativePath: 'DC' })
    expect(insideDC.comics).toEqual([])
    expect(insideDC.subfolders).toEqual([
      {
        name: 'Ano Um',
        folderId,
        relativePath: 'DC/Ano Um',
        comicCount: 2,
        coverUrl: null,
        hasDirectComics: true,
      },
      {
        name: 'Elseworlds',
        folderId,
        relativePath: 'DC/Elseworlds',
        comicCount: 1,
        coverUrl: null,
        hasDirectComics: true,
      },
    ])

    const insideAnoUm = service.browseFolder({ folderId, relativePath: 'DC/Ano Um' })
    expect(insideAnoUm.subfolders).toEqual([])
    expect(insideAnoUm.comics.map((c) => c.id)).toEqual([nested1.id, nested2.id])
  })

  it('lança NOT_FOUND para um folderId inexistente', () => {
    expect(() => service.browseFolder({ folderId: randomUUID(), relativePath: '' })).toThrowError(
      AppError,
    )
  })
})

describe('LibraryService.home', () => {
  it('separa continueReading (em andamento) de recentlyAdded', () => {
    const reading = makeInput()
    const untouched = makeInput()
    insertComic(db, reading)
    insertComic(db, untouched)
    setCurrentPage(db, reading.id, 1)

    const home = service.home()
    expect(home.continueReading.map((c) => c.id)).toEqual([reading.id])
    expect(home.recentlyAdded.map((c) => c.id).sort()).toEqual([reading.id, untouched.id].sort())
  })
})
