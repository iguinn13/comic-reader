import { extname } from 'path'
import { IMAGE_PAGE_EXTENSIONS } from '@shared/constants'

/**
 * Ordem natural sobre o caminho completo da entrada (docs/05-importacao.md
 * §5): `Intl.Collator('en', { numeric: true, sensitivity: 'base' })` faz
 * `pasta1/10.jpg` vir depois de `pasta1/2.jpg`, respeitando as subpastas.
 */
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function naturalSort(paths: string[]): string[] {
  return [...paths].sort(collator.compare)
}

const IGNORED_BASENAMES = new Set(['thumbs.db', 'desktop.ini', 'comicinfo.xml'])

/**
 * Filtra lixo comum de arquivos compactados de HQs (docs/05 §5): entradas de
 * diretório, `__MACOSX/`, arquivos ocultos (`._001.jpg`), metadados e
 * qualquer entrada cuja extensão não esteja em `IMAGE_PAGE_EXTENSIONS`.
 */
export function isIgnoredEntry(path: string): boolean {
  if (path === '' || path.endsWith('/')) return true // entrada de diretório

  const segments = path.split('/')
  if (segments.includes('__MACOSX')) return true

  const baseName = segments[segments.length - 1] ?? ''
  if (baseName.startsWith('.')) return true // ex.: ._001.jpg
  if (IGNORED_BASENAMES.has(baseName.toLowerCase())) return true

  const ext = extname(baseName).toLowerCase()
  return !(IMAGE_PAGE_EXTENSIONS as readonly string[]).includes(ext)
}
