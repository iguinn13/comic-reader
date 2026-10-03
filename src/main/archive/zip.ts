import { createWriteStream } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import yauzl from 'yauzl'
import { AppError } from '@shared/errors'
import { isIgnoredEntry, naturalSort } from './natural-sort'
import type { ArchivePageEntry, ComicArchive } from './types'
export class ZipArchive implements ComicArchive {
  private constructor(
    private readonly zipfile: yauzl.ZipFile,
    private readonly entries: Map<string, yauzl.Entry>,
  ) {}
  static async open(buffer: Buffer): Promise<ZipArchive> {
    const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, file) => {
        if (error || !file) {
          reject(new AppError('CORRUPTED_FILE', 'errors.corruptedFile', error?.message))
          return
        }
        resolve(file)
      })
    })
    const entries = new Map<string, yauzl.Entry>()
    await new Promise<void>((resolve, reject) => {
      zipfile.on('entry', (entry: yauzl.Entry) => {
        entries.set(entry.fileName, entry)
        zipfile.readEntry()
      })
      zipfile.on('end', () => resolve())
      zipfile.on('error', (error: Error) => {
        reject(new AppError('CORRUPTED_FILE', 'errors.corruptedFile', error.message))
      })
      zipfile.readEntry()
    })
    return new ZipArchive(zipfile, entries)
  }
  rawEntryNames(): string[] {
    return [...this.entries.keys()].filter((name) => !name.endsWith('/'))
  }
  listPages(): Promise<ArchivePageEntry[]> {
    const names = naturalSort([...this.entries.keys()].filter((name) => !isIgnoredEntry(name)))
    return Promise.resolve(
      names.map((entryName, index) => ({
        index,
        entryName,
        size: this.entries.get(entryName)?.uncompressedSize ?? 0,
      })),
    )
  }
  async readPage(entryName: string): Promise<Buffer> {
    const entry = this.entries.get(entryName)
    if (!entry) {
      throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile', `entrada ausente: ${entryName}`)
    }
    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      this.zipfile.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          reject(new AppError('CORRUPTED_FILE', 'errors.corruptedFile', error?.message))
          return
        }
        resolve(readStream)
      })
    })
    const chunks: Buffer[] = []
    for await (const chunk of stream as Readable) {
      chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks)
  }
  async extractAll(
    destDir: string,
    onPage: (index: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const pages = await this.listPages()
    for (const page of pages) {
      if (signal.aborted) throw new AppError('CANCELLED', 'errors.cancelled')
      const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
        const entry = this.entries.get(page.entryName)
        if (!entry) {
          reject(new AppError('CORRUPTED_FILE', 'errors.corruptedFile'))
          return
        }
        this.zipfile.openReadStream(entry, (error, readStream) => {
          if (error || !readStream) {
            reject(new AppError('CORRUPTED_FILE', 'errors.corruptedFile', error?.message))
            return
          }
          resolve(readStream)
        })
      })
      const destFile = join(destDir, String(page.index).padStart(4, '0'))
      await pipeline(stream, createWriteStream(destFile))
      onPage(page.index)
    }
  }
  close(): Promise<void> {
    this.zipfile.close()
    return Promise.resolve()
  }
}
