import { AppError } from '@shared/errors'
import { RarArchive } from './rar'
import type { ComicArchive } from './types'
import { ZipArchive } from './zip'

export type { ArchivePageEntry, ComicArchive } from './types'
export { detectFormat, type DetectedFormat } from './detect'
export { isIgnoredEntry, naturalSort } from './natural-sort'
export { ZipArchive } from './zip'
export { RarArchive } from './rar'

/** Escolhe a implementação de `ComicArchive` certa pelo formato já detectado. */
export async function openArchive(buffer: Buffer, format: 'zip' | 'rar'): Promise<ComicArchive> {
  if (format === 'zip') return ZipArchive.open(buffer)
  if (format === 'rar') return RarArchive.open(buffer)
  throw new AppError('UNSUPPORTED_FORMAT', 'errors.unsupportedFormat')
}
