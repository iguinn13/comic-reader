import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { createAppPaths } from './paths'

describe('createAppPaths', () => {
  const root = '/tmp/comic-reader-test-userdata'
  const paths = createAppPaths(root)

  it('resolve o banco na raiz de userData', () => {
    expect(paths.dbFile).toBe(join(root, 'comic-reader.db'))
  })

  it('monta o caminho de arquivo de uma HQ pelo id e formato real', () => {
    expect(paths.comicFile('abc-123', 'cbz')).toBe(join(root, 'library', 'abc-123.cbz'))
    expect(paths.comicFile('abc-123', 'pdf')).toBe(join(root, 'library', 'abc-123.pdf'))
  })

  it('monta a capa de uma HQ e de uma coleção em subpastas separadas', () => {
    expect(paths.comicCoverFile('abc-123')).toBe(join(root, 'covers', 'comics', 'abc-123.jpg'))
    expect(paths.collectionCoverFile('col-9')).toBe(
      join(root, 'covers', 'collections', 'col-9.jpg'),
    )
  })

  it('monta o nome do arquivo de página de cache com 4 dígitos', () => {
    expect(paths.comicPageCacheFile('abc-123', 7, 'jpg')).toBe(
      join(root, 'cache', 'pages', 'abc-123', '0007.jpg'),
    )
    expect(paths.comicPageCacheFile('abc-123', 12345, 'png')).toBe(
      join(root, 'cache', 'pages', 'abc-123', '12345.png'),
    )
  })

  it('marca a extração completa dentro do próprio diretório de páginas da HQ', () => {
    expect(paths.comicPagesCompleteMarker('abc-123')).toBe(
      join(paths.comicPagesCacheDir('abc-123'), '.complete'),
    )
  })

  it('lista todos os diretórios que precisam existir antes do boot', () => {
    expect(paths.allDirectories).toEqual([
      paths.libraryDir,
      paths.coversComicsDir,
      paths.coversCollectionsDir,
      paths.cachePagesDir,
      paths.cacheTmpDir,
      paths.logsDir,
    ])
  })
})
