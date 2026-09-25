import type { ComicFormat } from '@shared/types'
import type { ComicFileFormat } from './paths'

/** Extensão do arquivo salvo em `library/` para cada formato detectado (docs/03 §3). */
export const FORMAT_TO_FILE_EXT: Record<ComicFormat, ComicFileFormat> = {
  zip: 'cbz',
  rar: 'cbr',
  pdf: 'pdf',
}
