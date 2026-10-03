import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { logger } from '../utils/logger'
import type { ResizeToJpeg } from '../utils/native-image-adapter'
import type { AppPaths } from '../utils/paths'
const COVER_TARGET_WIDTH = 400
const COVER_JPEG_QUALITY = 82
export interface GenerateCoverResult {
  coverVersion: number
}
export class CoverService {
  constructor(
    private readonly paths: AppPaths,
    private readonly resizeToJpeg: ResizeToJpeg,
  ) {}
  async generateComicCover(
    comicId: string,
    firstPageBuffer: Buffer | null,
  ): Promise<GenerateCoverResult | null> {
    if (firstPageBuffer === null) return null
    try {
      const jpeg = this.resizeToJpeg(firstPageBuffer, COVER_TARGET_WIDTH, COVER_JPEG_QUALITY)
      const destFile = this.paths.comicCoverFile(comicId)
      await mkdir(dirname(destFile), { recursive: true })
      await writeFile(destFile, jpeg)
      return { coverVersion: 1 }
    } catch (error) {
      logger.error(`[cover] falha ao gerar capa da HQ ${comicId}:`, error)
      return null
    }
  }
}
