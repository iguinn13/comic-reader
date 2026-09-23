import { createHash, randomUUID } from 'crypto'
import type { Stats } from 'fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, extname } from 'path'
import { PDFDocument } from 'pdf-lib'
import { AppError, type AppErrorCode } from '@shared/errors'
import type { ComicFormat, ImportItem, ImportItemStatus, ImportJobState } from '@shared/types'
import { detectFormat, openArchive, ZipArchive, type ComicArchive } from '../archive'
import type { Db } from '../db/client'
import { getComicsByHash, insertComic, type InsertComicPageInput } from '../db/repositories/comics'
import { logger } from '../utils/logger'
import { normalizeText } from '../utils/normalize'
import type { AppPaths, ComicFileFormat } from '../utils/paths'
import { titleFromFileName } from '../utils/title'
import type { CoverService } from './cover-service'

/** Como localizar os bytes originais de um item na fila (docs/05 §2). */
type ItemSource =
  { kind: 'file'; path: string } | { kind: 'zip-entry'; zipPath: string; entryName: string }

interface InternalItem {
  id: string
  sourceName: string
  status: ImportItemStatus
  errorCode?: AppErrorCode
  comicId?: string
  duplicateOf?: { id: string; title: string }
  source: ItemSource
  abortController: AbortController
  /** Guardado entre o passo 5 (duplicata) e a resolução, para não refazer os passos 1-5. */
  pending?: {
    tmpFile: string
    format: ComicFormat
    buffer: Buffer
    hash: string
    pages: InsertComicPageInput[]
    archive: ComicArchive | null
  }
}

interface InternalJob {
  jobId: string
  status: ImportJobState['status']
  items: InternalItem[]
  startedAt: number
  finishedAt: number | null
  /** "Aplicar aos próximos duplicados" (docs/05 §6). */
  applyToAllDuplicates: 'skip' | 'import' | null
  /** `cancel()` foi chamado neste job — vira `status: 'cancelled'` ao terminar, em vez de `'finished'`. */
  cancelRequested: boolean
}

const FORMAT_TO_FILE_EXT: Record<ComicFormat, ComicFileFormat> = {
  zip: 'cbz',
  rar: 'cbr',
  pdf: 'pdf',
}

/**
 * Fila e pipeline de importação (docs/05-importacao.md). Serviço central do
 * M2: expande os caminhos recebidos em itens, processa cada um
 * sequencialmente em 8 passos, e reporta progresso via `onProgress`
 * (injetado — este serviço nunca importa `electron`/`BrowserWindow`
 * diretamente, docs/02-arquitetura.md §3).
 */
export class ImportService {
  private job: InternalJob | null = null
  private pendingPaths: string[] = []
  private loopRunning = false

  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
    private readonly coverService: CoverService,
    private readonly onProgress: (state: ImportJobState) => void,
  ) {}

  start(inputPaths: string[]): { jobId: string } {
    if (!this.job || this.isJobDone(this.job)) {
      this.job = {
        jobId: randomUUID(),
        status: 'running',
        items: [],
        startedAt: Date.now(),
        finishedAt: null,
        applyToAllDuplicates: null,
        cancelRequested: false,
      }
    } else {
      this.job.status = 'running'
    }

    this.pendingPaths.push(...inputPaths)
    this.emit()

    void this.runLoop()

    return { jobId: this.job.jobId }
  }

  cancel(jobId: string): void {
    if (!this.job || this.job.jobId !== jobId) return
    const job = this.job
    job.cancelRequested = true

    for (const item of job.items) {
      if (item.status === 'queued') {
        item.status = 'cancelled'
      } else if (item.status === 'awaiting-duplicate-decision') {
        item.status = 'cancelled'
        void this.rollbackPending(item)
      } else if (item.status === 'processing') {
        item.abortController.abort()
      }
    }
    // Caminhos ainda não expandidos nunca viraram itens: descarta.
    this.pendingPaths = []
    if (job.status === 'paused-for-decision') job.status = 'running'
    this.emit()
    void this.runLoop()
  }

  resolveDuplicate(
    jobId: string,
    itemId: string,
    decision: 'skip' | 'import',
    applyToAll: boolean,
  ): void {
    if (!this.job || this.job.jobId !== jobId) return
    const item = this.job.items.find((i) => i.id === itemId)
    if (!item || item.status !== 'awaiting-duplicate-decision') return

    if (applyToAll) this.job.applyToAllDuplicates = decision

    void this.finishDuplicateDecision(item, decision)
  }

  getJob(): ImportJobState | null {
    return this.job ? this.toPublicState(this.job) : null
  }

  // --- Loop principal ------------------------------------------------

  private async runLoop(): Promise<void> {
    if (this.loopRunning) return
    this.loopRunning = true
    try {
      while (true) {
        const job = this.job
        if (!job) break
        if (job.status === 'paused-for-decision' || job.status === 'cancelled') break

        if (this.pendingPaths.length > 0) {
          const nextPath = this.pendingPaths.shift() as string
          const newItems = await this.expand(nextPath)
          job.items.push(...newItems)
          this.emit()
          continue
        }

        const nextItem = job.items.find((i) => i.status === 'queued')
        if (!nextItem) break

        await this.processItem(nextItem)
        this.emit()

        // Uma decisão de duplicata pausou o job durante o processItem acima.
        // (cast: TS estreita `job.status` pelo check da linha acima e não
        // sabe que `processItem` pode reatribuí-lo por dentro.)
        if ((job.status as ImportJobState['status']) === 'paused-for-decision') break
      }

      this.finalizeIfDone()
    } finally {
      this.loopRunning = false
    }
  }

  /**
   * Fecha o job quando todos os itens estão em estado final (docs/05 §6): o
   * job termina como `finished` mesmo que `cancel()` tenha sido chamado no
   * meio — os itens individuais já carregam `status: 'cancelled'`, então o
   * resumo (RF-04) consegue distinguir; `finished` aqui só significa "a fila
   * parou de processar".
   */
  private finalizeIfDone(): void {
    const job = this.job
    if (!job) return
    if (job.status === 'paused-for-decision') return
    if (this.pendingPaths.length > 0) return

    const allFinal = job.items.every((i) => this.isFinalStatus(i.status))
    if (!allFinal) return

    job.status = job.cancelRequested ? 'cancelled' : 'finished'
    job.finishedAt = Date.now()
    this.emit()
  }

  private isFinalStatus(status: ImportItemStatus): boolean {
    return (
      status === 'done' ||
      status === 'skipped-duplicate' ||
      status === 'failed' ||
      status === 'cancelled'
    )
  }

  private isJobDone(job: InternalJob): boolean {
    return job.status === 'finished' || job.status === 'cancelled'
  }

  // --- Expansão (docs/05 §2 e §3) ------------------------------------

  private async expand(rawPath: string): Promise<InternalItem[]> {
    const sourceName = basename(rawPath)

    let stats: Stats
    try {
      stats = await stat(rawPath)
    } catch {
      return [this.makeFailedItem(sourceName, { kind: 'file', path: rawPath }, 'IO')]
    }
    if (!stats.isFile()) {
      return [this.makeFailedItem(sourceName, { kind: 'file', path: rawPath }, 'IO')]
    }

    const ext = extname(rawPath).toLowerCase()
    if (ext === '.cbz' || ext === '.cbr' || ext === '.pdf') {
      return [this.makeQueuedItem(sourceName, { kind: 'file', path: rawPath })]
    }
    if (ext === '.zip') {
      return this.expandZip(rawPath, sourceName)
    }
    return [this.makeFailedItem(sourceName, { kind: 'file', path: rawPath }, 'UNSUPPORTED_FORMAT')]
  }

  private async expandZip(zipPath: string, sourceName: string): Promise<InternalItem[]> {
    let buffer: Buffer
    try {
      buffer = await readFile(zipPath)
    } catch {
      return [this.makeFailedItem(sourceName, { kind: 'file', path: zipPath }, 'IO')]
    }

    let archive: ZipArchive
    try {
      archive = await ZipArchive.open(buffer)
    } catch {
      return [this.makeFailedItem(sourceName, { kind: 'file', path: zipPath }, 'CORRUPTED_FILE')]
    }

    try {
      const rawNames = archive.rawEntryNames()
      const innerComicNames = rawNames.filter((name) =>
        ['.cbz', '.cbr', '.pdf'].includes(extname(name).toLowerCase()),
      )
      const innerZipNames = rawNames.filter((name) => extname(name).toLowerCase() === '.zip')
      const pages = await archive.listPages()

      const items: InternalItem[] = []

      for (const innerZip of innerZipNames) {
        items.push(
          this.makeFailedItem(
            `${sourceName} › ${basename(innerZip)}`,
            { kind: 'file', path: zipPath },
            'UNSUPPORTED_FORMAT',
          ),
        )
      }

      if (innerComicNames.length > 0) {
        for (const entryName of innerComicNames) {
          items.push(
            this.makeQueuedItem(`${sourceName} › ${basename(entryName)}`, {
              kind: 'zip-entry',
              zipPath,
              entryName,
            }),
          )
        }
        if (pages.length > 0) {
          logger.warn(
            `[import] ${pages.length} imagens soltas ignoradas em ${sourceName} (HQs internas encontradas)`,
          )
        }
        return items
      }

      if (pages.length > 0) {
        // Nenhuma HQ interna, só imagens: o ZIP inteiro vira uma HQ (docs/05 §3).
        return [...items, this.makeQueuedItem(sourceName, { kind: 'file', path: zipPath })]
      }

      if (items.length > 0) {
        // Só tinha ZIPs internos (sem HQ nem imagem solta utilizável).
        return items
      }

      return [this.makeFailedItem(sourceName, { kind: 'file', path: zipPath }, 'CORRUPTED_FILE')]
    } finally {
      await archive.close()
    }
  }

  private makeQueuedItem(sourceName: string, source: ItemSource): InternalItem {
    return {
      id: randomUUID(),
      sourceName,
      status: 'queued',
      source,
      abortController: new AbortController(),
    }
  }

  private makeFailedItem(
    sourceName: string,
    source: ItemSource,
    errorCode: AppErrorCode,
  ): InternalItem {
    return {
      id: randomUUID(),
      sourceName,
      status: 'failed',
      errorCode,
      source,
      abortController: new AbortController(),
    }
  }

  // --- Pipeline de um item (docs/05 §4) -------------------------------

  private async processItem(item: InternalItem): Promise<void> {
    item.status = 'processing'
    this.emit()

    const signal = item.abortController.signal
    const tmpFile = this.paths.importTmpFile(item.id)

    try {
      // 1. Materializar.
      await this.materialize(item, tmpFile)
      this.throwIfAborted(signal)

      // 2. Detectar formato real + ler o conteúdo inteiro (ver decisão de
      // simplificação no relatório final: fixtures são pequenas e isso
      // evita duplicar a leitura em passos separados).
      const buffer = await readFile(tmpFile)
      const detected = detectFormat(buffer)
      if (detected === 'unknown') {
        throw new AppError('UNSUPPORTED_FORMAT', 'errors.unsupportedFormat')
      }
      this.throwIfAborted(signal)

      // 3. Validar e listar páginas.
      let pages: InsertComicPageInput[] = []
      let archive: ComicArchive | null = null
      if (detected === 'zip' || detected === 'rar') {
        archive = await openArchive(buffer, detected)
        const archivePages = await archive.listPages()
        if (archivePages.length === 0) {
          await archive.close()
          throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile')
        }
        pages = archivePages.map((p) => ({ pageIndex: p.index, entryName: p.entryName }))
      } else {
        const pageCount = await this.getPdfPageCount(buffer)
        if (pageCount < 1) {
          throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile')
        }
      }
      this.throwIfAborted(signal)

      // 4. Hash SHA-1.
      const hash = createHash('sha1').update(buffer).digest('hex')

      // 5. Duplicata.
      const duplicates = getComicsByHash(this.db, hash)
      const existing = duplicates[0]
      if (existing) {
        const policy = this.job?.applyToAllDuplicates
        if (policy === 'skip') {
          if (archive) await archive.close()
          item.status = 'skipped-duplicate'
          item.duplicateOf = existing
          await this.rollbackFiles(tmpFile)
          return
        }
        if (policy !== 'import') {
          // Pausa: guarda o estado para retomar em resolveDuplicate().
          item.status = 'awaiting-duplicate-decision'
          item.duplicateOf = existing
          item.pending = {
            tmpFile,
            format: detected,
            buffer,
            hash,
            pages,
            archive,
          }
          if (this.job) this.job.status = 'paused-for-decision'
          return
        }
        // policy === 'import': segue o fluxo normal abaixo (cria duplicata mesmo assim).
      }

      await this.finishImport(item, { tmpFile, format: detected, buffer, hash, pages, archive })
    } catch (error) {
      await this.rollbackFiles(tmpFile)
      if (error instanceof AppError && error.code === 'CANCELLED') {
        item.status = 'cancelled'
      } else if (error instanceof AppError) {
        item.status = 'failed'
        item.errorCode = error.code
      } else {
        item.status = 'failed'
        item.errorCode = 'INTERNAL'
        logger.error(`[import] erro inesperado no item ${item.sourceName}:`, error)
      }
    }
  }

  /** Passos 6-8, reaproveitado tanto no fluxo normal quanto após `resolveDuplicate`. */
  private async finishImport(
    item: InternalItem,
    ctx: {
      tmpFile: string
      format: ComicFormat
      buffer: Buffer
      hash: string
      pages: InsertComicPageInput[]
      archive: ComicArchive | null
    },
  ): Promise<void> {
    const comicId = randomUUID()
    const fileExt = FORMAT_TO_FILE_EXT[ctx.format]
    const destFile = this.paths.comicFile(comicId, fileExt)

    try {
      // 6. Mover para a biblioteca.
      await mkdir(this.paths.libraryDir, { recursive: true })
      await rename(ctx.tmpFile, destFile)

      // 7. Capa (nunca falha o item).
      let firstPageBuffer: Buffer | null = null
      if (ctx.archive && ctx.pages.length > 0) {
        const firstPage = ctx.pages[0]
        if (firstPage) {
          try {
            firstPageBuffer = await ctx.archive.readPage(firstPage.entryName)
          } catch (error) {
            logger.error(
              `[import] falha ao ler a primeira página para a capa de ${item.sourceName}:`,
              error,
            )
          }
        }
      }
      // PDF: capa fica como placeholder (ver TODO em cover-service.ts).
      const cover = await this.coverService.generateComicCover(comicId, firstPageBuffer)

      if (ctx.archive) await ctx.archive.close()

      // 8. Banco, numa transação (insertComic já faz isso).
      const originalFileName = this.originalFileNameForItem(item)
      const title = titleFromFileName(originalFileName)
      const now = Date.now()
      insertComic(this.db, {
        id: comicId,
        title,
        titleNormalized: normalizeText(title),
        format: ctx.format,
        fileName: `${comicId}.${fileExt}`,
        originalFileName,
        fileSize: ctx.buffer.byteLength,
        fileHash: ctx.hash,
        pageCount: ctx.format === 'pdf' ? await this.getPdfPageCount(ctx.buffer) : ctx.pages.length,
        createdAt: now,
        updatedAt: now,
        pages: ctx.format === 'pdf' ? [] : ctx.pages,
        coverVersion: cover?.coverVersion ?? 0,
      })

      item.status = 'done'
      item.comicId = comicId
    } catch (error) {
      await this.rollbackFiles(ctx.tmpFile, destFile, this.paths.comicCoverFile(comicId))
      if (ctx.archive) await ctx.archive.close().catch(() => undefined)
      throw error instanceof AppError ? error : new AppError('INTERNAL', 'errors.internal')
    }
  }

  private async finishDuplicateDecision(
    item: InternalItem,
    decision: 'skip' | 'import',
  ): Promise<void> {
    const pending = item.pending
    if (!pending) return
    item.pending = undefined

    // Sai do estado "paused"/"awaiting-duplicate-decision" imediatamente
    // (antes de qualquer `await`), para que uma segunda chamada concorrente
    // a `resolveDuplicate()` para o mesmo item (ex.: um clique duplo no
    // botão, ou um observador que reage ao evento de progresso) veja
    // `item.pending` já limpo e o status já mudado, e não reentre aqui.
    if (this.job) this.job.status = 'running'

    if (decision === 'skip') {
      if (pending.archive) await pending.archive.close()
      item.status = 'skipped-duplicate'
      await this.rollbackFiles(pending.tmpFile)
      this.emit()
      void this.runLoop()
      return
    }

    item.status = 'processing'
    this.emit()

    try {
      await this.finishImport(item, pending)
    } catch (error) {
      item.status = 'failed'
      item.errorCode = error instanceof AppError ? error.code : 'INTERNAL'
    }
    this.emit()
    void this.runLoop()
  }

  private async materialize(item: InternalItem, tmpFile: string): Promise<void> {
    await mkdir(this.paths.cacheTmpDir, { recursive: true })

    if (item.source.kind === 'file') {
      const buffer = await readFile(item.source.path).catch(() => {
        throw new AppError('IO', 'errors.io')
      })
      await this.writeTmp(tmpFile, buffer)
      return
    }

    // zip-entry: extrai a entrada interna do zip externo.
    const outerBuffer = await readFile(item.source.zipPath).catch(() => {
      throw new AppError('IO', 'errors.io')
    })
    const outerArchive = await ZipArchive.open(outerBuffer).catch(() => {
      throw new AppError('IO', 'errors.io')
    })
    try {
      const content = await outerArchive.readPage(item.source.entryName)
      await this.writeTmp(tmpFile, content)
    } finally {
      await outerArchive.close()
    }
  }

  private async writeTmp(tmpFile: string, buffer: Buffer): Promise<void> {
    await writeFile(tmpFile, buffer)
  }

  private async getPdfPageCount(buffer: Buffer): Promise<number> {
    try {
      const doc = await PDFDocument.load(buffer)
      return doc.getPageCount()
    } catch {
      throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile')
    }
  }

  private originalFileNameForItem(item: InternalItem): string {
    if (item.source.kind === 'file') return basename(item.source.path)
    return basename(item.source.entryName)
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new AppError('CANCELLED', 'errors.cancelled')
  }

  private async rollbackFiles(...paths: string[]): Promise<void> {
    await Promise.all(
      paths.map((p) =>
        rm(p, { force: true }).catch((error: unknown) => {
          logger.error(`[import] falha ao limpar ${p} no rollback:`, error)
        }),
      ),
    )
  }

  private async rollbackPending(item: InternalItem): Promise<void> {
    const pending = item.pending
    if (!pending) return
    item.pending = undefined
    if (pending.archive) await pending.archive.close().catch(() => undefined)
    await this.rollbackFiles(pending.tmpFile)
  }

  // --- Progresso -------------------------------------------------------

  private emit(): void {
    if (!this.job) return
    this.onProgress(this.toPublicState(this.job))
  }

  private toPublicState(job: InternalJob): ImportJobState {
    const items: ImportItem[] = job.items.map((i) => ({
      id: i.id,
      sourceName: i.sourceName,
      status: i.status,
      errorCode: i.errorCode,
      comicId: i.comicId,
      duplicateOf: i.duplicateOf,
    }))

    const done = items.filter((i) => i.status === 'done').length
    const skipped = items.filter((i) => i.status === 'skipped-duplicate').length
    const failed = items.filter((i) => i.status === 'failed' || i.status === 'cancelled').length

    return {
      jobId: job.jobId,
      status: job.status,
      items,
      counts: { total: items.length, done, skipped, failed },
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    }
  }
}
