import { createHash } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { statSync } from 'fs'
import { dirname } from 'path'
import type { ResizeToJpeg } from '../utils/native-image-adapter'
import type { AppPaths } from '../utils/paths'

const COVER_TARGET_WIDTH = 400
const COVER_JPEG_QUALITY = 82

/** Chave estável (hash) de uma pasta: não há tabela de pastas, só `folderId` + caminho relativo. */
export function folderCoverKey(location: { folderId: string; relativePath: string }): string {
  return createHash('sha1').update(`${location.folderId}:${location.relativePath}`).digest('hex')
}

/**
 * Capa personalizada de pastas sem HQs (RF-64, docs/10 ADR-020). A imagem é
 * reduzida e salva em `covers/folders/{key}.jpg`; a existência do arquivo é o
 * único estado (sem tabela nova).
 */
export class FolderCoverService {
  constructor(
    private readonly paths: AppPaths,
    private readonly resizeToJpeg: ResizeToJpeg,
  ) {}

  /** URL `comic://` versionada pela data do arquivo, ou `null` se a pasta não tem capa própria. */
  coverUrl(location: { folderId: string; relativePath: string }): string | null {
    const key = folderCoverKey(location)
    try {
      const { mtimeMs } = statSync(this.paths.folderCoverFile(key))
      return `comic://cover/folder/${key}?v=${Math.floor(mtimeMs)}`
    } catch {
      return null
    }
  }

  async set(location: { folderId: string; relativePath: string }, imagePath: string): Promise<void> {
    const jpeg = this.resizeToJpeg(
      await readFile(imagePath),
      COVER_TARGET_WIDTH,
      COVER_JPEG_QUALITY,
    )
    const dest = this.paths.folderCoverFile(folderCoverKey(location))
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, jpeg)
  }

  async clear(location: { folderId: string; relativePath: string }): Promise<void> {
    await rm(this.paths.folderCoverFile(folderCoverKey(location)), { force: true })
  }
}

