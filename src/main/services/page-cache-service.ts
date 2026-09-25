import { existsSync, type Dirent } from 'fs'
import { mkdir, readdir, readFile, rm, stat, utimes, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { imageSize } from 'image-size'
import { openArchive, type ComicArchive } from '../archive'
import type { Db } from '../db/client'
import { getComicFileMeta } from '../db/repositories/comics'
import { getComicPage, listComicPages, updatePageDimensions } from '../db/repositories/pages'
import { getSetting } from '../db/repositories/settings'
import { FORMAT_TO_FILE_EXT } from '../utils/comic-format'
import { logger } from '../utils/logger'
import type { AppPaths } from '../utils/paths'

const DEFAULT_PAGE_EXTENSION = 'jpg'

export interface CachedPageFile {
  path: string
  contentType: string
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

function contentTypeFor(extension: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extension.toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Extração e cache de páginas de CBZ/CBR sob demanda + em segundo plano
 * (docs/06-leitor.md §7, RF-43, RF-51). PDF não passa por aqui: pdf.js
 * renderiza direto de `comic://file/{id}` (M4.9).
 */
export class PageCacheService {
  private readonly backgroundExtractions = new Map<string, Promise<void>>()
  private readonly inFlightPages = new Map<string, Promise<CachedPageFile>>()

  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
  ) {}

  /**
   * Chamado por `ReaderService.open`: garante que a extração completa está
   * em andamento (ou já terminou), sem bloquear quem chamou. A ordem de
   * prioridade é a página atual → fim → início (docs/06 §7).
   */
  ensure(comicId: string, startPage: number): void {
    if (this.backgroundExtractions.has(comicId)) {
      this.touchAccess(comicId)
      return
    }
    if (existsSync(this.paths.comicPagesCompleteMarker(comicId))) {
      this.touchAccess(comicId)
      return
    }

    const task = this.extractAllInBackground(comicId, startPage).finally(() => {
      this.backgroundExtractions.delete(comicId)
    })
    this.backgroundExtractions.set(comicId, task)
  }

  /** Usado pelo handler de `comic://page/{id}/{n}`. Extrai sob demanda se ainda não está no cache. */
  async getPage(comicId: string, pageIndex: number): Promise<CachedPageFile> {
    const key = `${comicId}:${pageIndex}`
    const inFlight = this.inFlightPages.get(key)
    if (inFlight) return inFlight

    const task = this.resolvePage(comicId, pageIndex).finally(() => {
      this.inFlightPages.delete(key)
    })
    this.inFlightPages.set(key, task)
    return task
  }

  private async resolvePage(comicId: string, pageIndex: number): Promise<CachedPageFile> {
    const page = getComicPage(this.db, comicId, pageIndex)
    if (!page) throw new Error(`página ${pageIndex} não encontrada para a HQ ${comicId}`)

    const extension = extname(page.entryName).replace('.', '') || DEFAULT_PAGE_EXTENSION
    const cacheFile = this.paths.comicPageCacheFile(comicId, pageIndex, extension)

    if (existsSync(cacheFile)) {
      this.touchAccess(comicId)
      return { path: cacheFile, contentType: contentTypeFor(extension) }
    }

    const meta = getComicFileMeta(this.db, comicId)
    if (!meta) throw new Error(`HQ ${comicId} não encontrada`)

    const archive = await this.openComicArchive(comicId, meta.format)
    try {
      const buffer = await archive.readPage(page.entryName)
      await mkdir(this.paths.comicPagesCacheDir(comicId), { recursive: true })
      await writeFile(cacheFile, buffer)
      if (page.width === null) this.measureAndStoreDimensions(comicId, [{ pageIndex, buffer }])
      this.touchAccess(comicId)
      return { path: cacheFile, contentType: contentTypeFor(extension) }
    } finally {
      await archive.close()
    }
  }

  private async openComicArchive(
    comicId: string,
    format: 'zip' | 'rar' | 'pdf',
  ): Promise<ComicArchive> {
    if (format === 'pdf') throw new Error('PDF não usa PageCacheService (comic://file + pdf.js)')
    const fileExt = FORMAT_TO_FILE_EXT[format]
    const buffer = await readFile(this.paths.comicFile(comicId, fileExt))
    return openArchive(buffer, format)
  }

  private async extractAllInBackground(comicId: string, startPage: number): Promise<void> {
    try {
      const meta = getComicFileMeta(this.db, comicId)
      if (!meta || meta.format === 'pdf') return

      const pagesByIndex = new Map(listComicPages(this.db, comicId).map((p) => [p.pageIndex, p]))
      const order = buildExtractionOrder(startPage, pagesByIndex.size)
      const archive = await this.openComicArchive(comicId, meta.format)
      const measured: { pageIndex: number; buffer: Buffer }[] = []

      try {
        for (const pageIndex of order) {
          const page = pagesByIndex.get(pageIndex)
          if (!page) continue
          const extension = extname(page.entryName).replace('.', '') || DEFAULT_PAGE_EXTENSION
          const cacheFile = this.paths.comicPageCacheFile(comicId, pageIndex, extension)
          if (existsSync(cacheFile)) continue

          const buffer = await archive.readPage(page.entryName)
          await mkdir(this.paths.comicPagesCacheDir(comicId), { recursive: true })
          await writeFile(cacheFile, buffer)
          if (page.width === null) measured.push({ pageIndex, buffer })
        }
      } finally {
        await archive.close()
      }

      this.measureAndStoreDimensions(comicId, measured)
      await mkdir(this.paths.comicPagesCacheDir(comicId), { recursive: true })
      await writeFile(this.paths.comicPagesCompleteMarker(comicId), '')
    } catch (error) {
      logger.error(`[page-cache] falha ao extrair a HQ ${comicId} em segundo plano:`, error)
    }
  }

  /** Mede com `image-size` e grava em lote; nunca lança (dimensão é só um extra pro modo duplo). */
  private measureAndStoreDimensions(
    comicId: string,
    pages: { pageIndex: number; buffer: Buffer }[],
  ): void {
    const updates: { pageIndex: number; width: number; height: number }[] = []
    for (const { pageIndex, buffer } of pages) {
      try {
        const { width, height } = imageSize(buffer)
        updates.push({ pageIndex, width, height })
      } catch {
        // Página sem dimensão detectável: o modo duplo assume retrato (docs/06 §3.2).
      }
    }
    updatePageDimensions(this.db, comicId, updates)
  }

  /** Toque de acesso pro LRU (docs/06 §7): o `mtime` do marcador é a "última leitura" da HQ. */
  private touchAccess(comicId: string): void {
    const marker = this.paths.comicPagesCompleteMarker(comicId)
    if (!existsSync(marker)) return
    const now = new Date()
    void utimes(marker, now, now).catch(() => {})
  }

  /**
   * Boot passo 4 (docs/02-arquitetura.md §7): libera espaço até
   * `cache.maxBytes`, removendo as HQs extraídas menos recentemente
   * acessadas primeiro — nunca a HQ aberta no momento (`keepComicId`).
   */
  async enforceLru(keepComicId: string | null): Promise<void> {
    const maxBytes = getSetting(this.db, 'cache.maxBytes')
    const entries = await this.listCachedComicEntries()

    let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0)
    if (totalBytes <= maxBytes) return

    const removable = entries
      .filter((entry) => entry.comicId !== keepComicId)
      .sort((a, b) => a.lastAccess - b.lastAccess)

    for (const entry of removable) {
      if (totalBytes <= maxBytes) break
      await rm(entry.dir, { recursive: true, force: true }).catch((error: unknown) => {
        logger.error(`[page-cache] falha ao remover o cache da HQ ${entry.comicId}:`, error)
      })
      totalBytes -= entry.bytes
    }
  }

  /** RF-51: bytes usados pelo cache de páginas. */
  async usageBytes(): Promise<number> {
    return directorySize(this.paths.cachePagesDir)
  }

  /** RF-51 "Limpar cache": apaga o cache de páginas (descartável), exceto `keepComicId`. Devolve os bytes liberados. */
  async clear(keepComicId: string | null = null): Promise<number> {
    let comicIds: string[]
    try {
      comicIds = await readdir(this.paths.cachePagesDir)
    } catch {
      return 0
    }
    let freed = 0
    for (const comicId of comicIds) {
      if (comicId === keepComicId) continue
      const dir = this.paths.comicPagesCacheDir(comicId)
      freed += await directorySize(dir)
      await rm(dir, { recursive: true, force: true })
    }
    return freed
  }

  private async listCachedComicEntries(): Promise<
    { comicId: string; dir: string; bytes: number; lastAccess: number }[]
  > {
    let comicIds: string[]
    try {
      comicIds = await readdir(this.paths.cachePagesDir)
    } catch {
      return []
    }

    const entries = await Promise.all(
      comicIds.map(async (comicId) => {
        const dir = this.paths.comicPagesCacheDir(comicId)
        const marker = this.paths.comicPagesCompleteMarker(comicId)
        if (!existsSync(marker)) return null

        const [bytes, markerStat] = await Promise.all([directorySize(dir), stat(marker)])
        return { comicId, dir, bytes, lastAccess: markerStat.mtimeMs }
      }),
    )

    return entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }
}

/** Página atual → fim → início (docs/06-leitor.md §7). */
export function buildExtractionOrder(startPage: number, total: number): number[] {
  const order: number[] = []
  for (let i = startPage; i < total; i++) order.push(i)
  for (let i = startPage - 1; i >= 0; i--) order.push(i)
  return order
}

async function directorySize(dir: string): Promise<number> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  let total = 0
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    total += entry.isDirectory() ? await directorySize(fullPath) : (await stat(fullPath)).size
  }
  return total
}
