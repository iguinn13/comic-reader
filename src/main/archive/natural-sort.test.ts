import { describe, expect, it } from 'vitest'
import { isIgnoredEntry, naturalSort } from './natural-sort'
describe('naturalSort', () => {
  it('ordena números por valor, não lexicograficamente (docs/09 §2.2)', () => {
    expect(naturalSort(['10.jpg', '2.jpg', '1.jpg'])).toEqual(['1.jpg', '2.jpg', '10.jpg'])
  })
  it('respeita subpastas: pasta1/10.jpg vem depois de pasta1/2.jpg', () => {
    expect(naturalSort(['pasta1/10.jpg', 'pasta1/2.jpg'])).toEqual([
      'pasta1/2.jpg',
      'pasta1/10.jpg',
    ])
  })
  it('agrupa por pasta antes de comparar números entre pastas diferentes', () => {
    expect(naturalSort(['cap2/1.jpg', 'cap1/2.jpg', 'cap1/1.jpg'])).toEqual([
      'cap1/1.jpg',
      'cap1/2.jpg',
      'cap2/1.jpg',
    ])
  })
})
describe('isIgnoredEntry', () => {
  it('ignora entradas de diretório', () => {
    expect(isIgnoredEntry('pasta/')).toBe(true)
  })
  it('ignora __MACOSX', () => {
    expect(isIgnoredEntry('__MACOSX/._1.jpg')).toBe(true)
  })
  it('ignora arquivos ocultos (._x.jpg)', () => {
    expect(isIgnoredEntry('._1.jpg')).toBe(true)
  })
  it('ignora Thumbs.db e desktop.ini', () => {
    expect(isIgnoredEntry('Thumbs.db')).toBe(true)
    expect(isIgnoredEntry('desktop.ini')).toBe(true)
  })
  it('ignora ComicInfo.xml e outras extensões não-imagem', () => {
    expect(isIgnoredEntry('ComicInfo.xml')).toBe(true)
    expect(isIgnoredEntry('readme.txt')).toBe(true)
    expect(isIgnoredEntry('info.nfo')).toBe(true)
    expect(isIgnoredEntry('site.url')).toBe(true)
  })
  it('não ignora páginas de imagem válidas', () => {
    expect(isIgnoredEntry('01.jpg')).toBe(false)
    expect(isIgnoredEntry('cap1/02.PNG')).toBe(false)
  })
})
