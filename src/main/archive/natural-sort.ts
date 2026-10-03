import { extname } from 'path'
import { IMAGE_PAGE_EXTENSIONS } from '@shared/constants'
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
export function naturalSort(paths: string[]): string[] {
  return [...paths].sort(collator.compare)
}
const IGNORED_BASENAMES = new Set(['thumbs.db', 'desktop.ini', 'comicinfo.xml'])
export function isIgnoredEntry(path: string): boolean {
  if (path === '' || path.endsWith('/')) return true
  const segments = path.split('/')
  if (segments.includes('__MACOSX')) return true
  const baseName = segments[segments.length - 1] ?? ''
  if (baseName.startsWith('.')) return true
  if (IGNORED_BASENAMES.has(baseName.toLowerCase())) return true
  const ext = extname(baseName).toLowerCase()
  return !(IMAGE_PAGE_EXTENSIONS as readonly string[]).includes(ext)
}
