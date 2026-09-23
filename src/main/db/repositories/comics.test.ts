import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../client'
import { comicPages, readingProgress } from '../schema'
import {
  deleteComics,
  getComicDetail,
  getComicsByHash,
  insertComic,
  listComics,
  renameComic,
  setFavorite,
  type InsertComicInput,
} from './comics'
import { markRead, setCurrentPage } from './progress'

let db: Db

function makeInput(overrides: Partial<InsertComicInput> = {}): InsertComicInput {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    title: 'Batman - Ano Um 01',
    titleNormalized: 'batman - ano um 01',
    format: 'zip',
    fileName: `${id}.cbz`,
    originalFileName: 'Batman_-_Ano_Um_01.cbz',
    fileSize: 1024,
    fileHash: `hash-${id}`,
    pageCount: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [
      { pageIndex: 0, entryName: '01.jpg', width: 800, height: 1200 },
      { pageIndex: 1, entryName: '02.jpg', width: 800, height: 1200 },
      { pageIndex: 2, entryName: '03.jpg', width: 800, height: 1200 },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  db = createDb(':memory:')
})

describe('insertComic', () => {
  it('insere a HQ, as páginas e a linha inicial de progresso numa transação', () => {
    const input = makeInput()
    insertComic(db, input)

    const detail = getComicDetail(db, input.id)
    expect(detail).not.toBeNull()
    expect(detail?.title).toBe(input.title)
    expect(detail?.currentPage).toBe(0)
    expect(detail?.completedAt).toBeNull()
    expect(detail?.status).toBe('unread')

    const pages = db.select().from(comicPages).all()
    expect(pages).toHaveLength(3)

    const progress = db.select().from(readingProgress).all()
    expect(progress).toHaveLength(1)
    expect(progress[0]?.comicId).toBe(input.id)
  })

  it('não cria linhas de comic_pages para PDF (pages vazio)', () => {
    const input = makeInput({ format: 'pdf', pages: [] })
    insertComic(db, input)

    const pages = db.select().from(comicPages).all()
    expect(pages).toHaveLength(0)
  })
})

describe('getComicDetail', () => {
  it('retorna null quando a HQ não existe', () => {
    expect(getComicDetail(db, randomUUID())).toBeNull()
  })
})

describe('listComics', () => {
  it('busca sem acento e em minúsculas por title_normalized', () => {
    insertComic(db, makeInput({ title: 'Ação em Dobro', titleNormalized: 'acao em dobro' }))
    insertComic(db, makeInput({ title: 'Outra Coisa', titleNormalized: 'outra coisa' }))

    const { items, total } = listComics(db, {
      searchNormalized: 'acao',
      sort: 'title',
      order: 'asc',
      status: 'all',
      favoritesOnly: false,
      limit: 50,
      offset: 0,
    })

    expect(total).toBe(1)
    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('Ação em Dobro')
  })

  it('filtra por favoritas', () => {
    const fav = makeInput()
    const notFav = makeInput()
    insertComic(db, fav)
    insertComic(db, notFav)
    setFavorite(db, fav.id, true)

    const { items } = listComics(db, {
      sort: 'createdAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: true,
      limit: 50,
      offset: 0,
    })

    expect(items.map((c) => c.id)).toEqual([fav.id])
  })

  it('filtra pelos 3 status derivados', () => {
    const unread = makeInput()
    const reading = makeInput()
    const read = makeInput()
    insertComic(db, unread)
    insertComic(db, reading)
    insertComic(db, read)
    setCurrentPage(db, reading.id, 2)
    markRead(db, read.id)

    const byStatus = (status: 'unread' | 'reading' | 'read'): string[] =>
      listComics(db, {
        sort: 'createdAt',
        order: 'asc',
        status,
        favoritesOnly: false,
        limit: 50,
        offset: 0,
      }).items.map((c) => c.id)

    expect(byStatus('unread')).toEqual([unread.id])
    expect(byStatus('reading')).toEqual([reading.id])
    expect(byStatus('read')).toEqual([read.id])
  })

  it('ordena por título com desempate estável por id', () => {
    const a = makeInput({
      id: '00000000-0000-0000-0000-000000000002',
      title: 'B',
      titleNormalized: 'b',
    })
    const b = makeInput({
      id: '00000000-0000-0000-0000-000000000001',
      title: 'B',
      titleNormalized: 'b',
    })
    const c = makeInput({
      id: '00000000-0000-0000-0000-000000000003',
      title: 'A',
      titleNormalized: 'a',
    })
    insertComic(db, a)
    insertComic(db, b)
    insertComic(db, c)

    const { items } = listComics(db, {
      sort: 'title',
      order: 'asc',
      status: 'all',
      favoritesOnly: false,
      limit: 50,
      offset: 0,
    })

    // "a" primeiro; empate entre as duas "B" desfeito pelo id (ordem crescente).
    expect(items.map((i) => i.id)).toEqual([c.id, b.id, a.id])
  })

  it('ordena por lastReadAt com nulos sempre por último', () => {
    const neverRead = makeInput()
    const readRecently = makeInput()
    insertComic(db, neverRead)
    insertComic(db, readRecently)
    setCurrentPage(db, readRecently.id, 1)

    const { items } = listComics(db, {
      sort: 'lastReadAt',
      order: 'desc',
      status: 'all',
      favoritesOnly: false,
      limit: 50,
      offset: 0,
    })

    expect(items.map((i) => i.id)).toEqual([readRecently.id, neverRead.id])
  })

  it('pagina com limit/offset e devolve o total sem paginação', () => {
    for (let i = 0; i < 5; i++) {
      insertComic(db, makeInput())
    }

    const page1 = listComics(db, {
      sort: 'createdAt',
      order: 'asc',
      status: 'all',
      favoritesOnly: false,
      limit: 2,
      offset: 0,
    })
    const page2 = listComics(db, {
      sort: 'createdAt',
      order: 'asc',
      status: 'all',
      favoritesOnly: false,
      limit: 2,
      offset: 2,
    })

    expect(page1.total).toBe(5)
    expect(page1.items).toHaveLength(2)
    expect(page2.items).toHaveLength(2)
    expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id)
  })
})

describe('renameComic', () => {
  it('atualiza título, título normalizado e updated_at', () => {
    const input = makeInput()
    insertComic(db, input)

    renameComic(db, input.id, 'Novo Título', 'novo titulo')

    const detail = getComicDetail(db, input.id)
    expect(detail?.title).toBe('Novo Título')
    expect(detail?.titleNormalized).toBe('novo titulo')
    expect(detail?.updatedAt).toBeGreaterThanOrEqual(input.updatedAt)
  })
})

describe('setFavorite', () => {
  it('marca e desmarca como favorita', () => {
    const input = makeInput()
    insertComic(db, input)

    setFavorite(db, input.id, true)
    expect(getComicDetail(db, input.id)?.isFavorite).toBe(true)

    setFavorite(db, input.id, false)
    expect(getComicDetail(db, input.id)?.isFavorite).toBe(false)
  })
})

describe('deleteComics', () => {
  it('apaga várias HQs e devolve quantas foram apagadas, com cascata em páginas e progresso', () => {
    const a = makeInput()
    const b = makeInput()
    const c = makeInput()
    insertComic(db, a)
    insertComic(db, b)
    insertComic(db, c)

    const deleted = deleteComics(db, [a.id, b.id])

    expect(deleted).toBe(2)
    expect(getComicDetail(db, a.id)).toBeNull()
    expect(getComicDetail(db, b.id)).toBeNull()
    expect(getComicDetail(db, c.id)).not.toBeNull()

    const remainingPages = db.select().from(comicPages).all()
    expect(remainingPages.every((p) => p.comicId === c.id)).toBe(true)

    const remainingProgress = db.select().from(readingProgress).all()
    expect(remainingProgress.map((p) => p.comicId)).toEqual([c.id])
  })

  it('devolve 0 quando a lista de ids está vazia', () => {
    expect(deleteComics(db, [])).toBe(0)
  })
})

describe('getComicsByHash', () => {
  it('encontra HQs com o mesmo hash, para checar duplicata', () => {
    const input = makeInput({ fileHash: 'sha1-same' })
    insertComic(db, input)

    const matches = getComicsByHash(db, 'sha1-same')
    expect(matches).toEqual([{ id: input.id, title: input.title }])
    expect(getComicsByHash(db, 'sha1-other')).toEqual([])
  })
})
