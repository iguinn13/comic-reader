import { createHash, randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { basename, dirname } from 'path'
import { PDFDocument } from 'pdf-lib'
import type { LibraryScanState } from '@shared/types'
import { detectFormat, openArchive, type ComicArchive } from '../archive'
import type { Db } from '../db/client'
import {
  getComicByFilePath,
  getComicsByHash,
  insertComic,
  listComicsInFolder,
  type InsertComicPageInput,
} from '../db/repositories/comics'
import { listLibraryFolders } from '../db/repositories/library-folders'
import { logger } from '../utils/logger'
import { normalizeText } from '../utils/normalize'
import { titleFromFileName } from '../utils/title'
import { walkDirectory } from '../utils/walk-directory'
import type { CoverService } from './cover-service'
import type { LibraryService } from './library-service'

export interface LibraryScanCallbacks {
  onProgress: (state: LibraryScanState) => void
  onChanged: (reason: 'scan') => void
}

/**
 * Escaneia recursivamente as pastas-raiz configuradas pelo usuário
 * (docs/05-importacao.md), indexando as HQs encontradas in-place — nunca
 * copiando para uma pasta interna (docs/10 ADR). Roda uma vez no boot e sob
 * demanda ("Atualizar biblioteca"). Duplicatas (mesmo hash em pastas
 * sobrepostas) e arquivos que sumiram do disco são resolvidos
 * silenciosamente, sem interação do usuário — o scan é automático.
 */
export class LibraryScanService {
  private scanning = false

  constructor(
    private readonly db: Db,
    private readonly coverService: CoverService,
    private readonly libraryService: LibraryService,
    private readonly callbacks: LibraryScanCallbacks,
  ) {}

  async scan(): Promise<void> {
    if (this.scanning) return
    this.scanning = true

    let scanned = 0
    let added = 0
    let removed = 0
    this.emit({ scanning: true, scanned, added, removed })

    try {
      const folders = listLibraryFolders(this.db)

      for (const folder of folders) {
        for await (const filePath of walkDirectory(folder.path)) {
          scanned++
          if (!getComicByFilePath(this.db, filePath)) {
            const wasAdded = await this.importFile(filePath, folder.id)
            if (wasAdded) added++
          }
          this.emit({ scanning: true, scanned, added, removed })
        }

        const missingIds = listComicsInFolder(this.db, folder.id)
          .filter((comic) => !existsSync(comic.filePath))
          .map((comic) => comic.id)

        if (missingIds.length > 0) {
          await this.libraryService.delete(missingIds, { deleteFile: false })
          removed += missingIds.length
          this.emit({ scanning: true, scanned, added, removed })
        }
      }
    } finally {
      this.scanning = false
      this.emit({ scanning: false, scanned, added, removed })
      this.callbacks.onChanged('scan')
    }
  }

  /** Devolve `true` se a HQ foi indexada; `false` se foi pulada (inválida ou duplicata). */
  private async importFile(filePath: string, folderId: string): Promise<boolean> {
    let archive: ComicArchive | null = null
    try {
      const buffer = await readFile(filePath)
      const detected = detectFormat(buffer)
      if (detected === 'unknown') {
        logger.warn(`[scan] formato não reconhecido, ignorado: "${filePath}"`)
        return false
      }

      let pages: InsertComicPageInput[] = []
      if (detected === 'zip' || detected === 'rar') {
        archive = await openArchive(buffer, detected)
        const archivePages = await archive.listPages()
        if (archivePages.length === 0) {
          logger.warn(`[scan] arquivo corrompido/sem páginas, ignorado: "${filePath}"`)
          return false
        }
        pages = archivePages.map((p) => ({ pageIndex: p.index, entryName: p.entryName }))
      } else {
        const pageCount = await this.getPdfPageCount(buffer)
        if (pageCount < 1) {
          logger.warn(`[scan] PDF corrompido/sem páginas, ignorado: "${filePath}"`)
          return false
        }
      }

      const hash = createHash('sha1').update(buffer).digest('hex')
      const duplicates = getComicsByHash(this.db, hash)
      const firstDuplicate = duplicates[0]
      if (firstDuplicate) {
        logger.warn(`[scan] "${filePath}" é duplicata de "${firstDuplicate.title}"; ignorado`)
        return false
      }

      const comicId = randomUUID()
      let firstPageBuffer: Buffer | null = null
      const firstPage = pages[0]
      if (archive && firstPage) {
        try {
          firstPageBuffer = await archive.readPage(firstPage.entryName)
        } catch (error) {
          logger.error(`[scan] falha ao ler a primeira página para a capa de "${filePath}":`, error)
        }
      }
      const cover = await this.coverService.generateComicCover(comicId, firstPageBuffer)

      const originalFileName = basename(filePath)
      const title = titleFromFileName(originalFileName)
      const now = Date.now()
      insertComic(this.db, {
        id: comicId,
        title,
        titleNormalized: normalizeText(title),
        format: detected,
        filePath,
        dirPath: dirname(filePath),
        folderId,
        originalFileName,
        fileSize: buffer.byteLength,
        fileHash: hash,
        pageCount: detected === 'pdf' ? await this.getPdfPageCount(buffer) : pages.length,
        createdAt: now,
        updatedAt: now,
        pages: detected === 'pdf' ? [] : pages,
        coverVersion: cover?.coverVersion ?? 0,
      })
      return true
    } catch (error) {
      logger.error(`[scan] falha ao indexar "${filePath}":`, error)
      return false
    } finally {
      if (archive) await archive.close().catch(() => undefined)
    }
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    try {
      const doc = await PDFDocument.load(buffer)
      return doc.getPageCount()
    } catch {
      return 0
    }
  }

  private emit(state: LibraryScanState): void {
    this.callbacks.onProgress(state)
  }
}
