import { writeFile } from 'fs/promises'
import { join } from 'path'
import { createExtractorFromData } from 'node-unrar-js'
import { AppError } from '@shared/errors'
import { isIgnoredEntry, naturalSort } from './natural-sort'
import type { ArchivePageEntry, ComicArchive } from './types'

/**
 * Leitor de RAR/CBR via `node-unrar-js` (WASM, sem binário nativo). A API do
 * pacote é assíncrona e opera sobre o arquivo inteiro em memória
 * (`createExtractorFromData`) — não há um "handle" persistente de arquivo
 * como no yauzl, então `RarArchive` guarda o `ArrayBuffer` e cria um novo
 * extractor a cada operação.
 *
 * Limitação conhecida (RAR é um formato sequencial por natureza): mesmo
 * pedindo `files: [entryName]` em `extract()`, o decoder WASM pode precisar
 * processar internamente as entradas anteriores do arquivo até chegar na
 * pedida. Isso é aceitável para HQs (dezenas/poucas centenas de páginas) e
 * não foi otimizado aqui — ver docs/05-importacao.md §8 sobre RAR > 1 GB.
 */
export class RarArchive implements ComicArchive {
  private constructor(private readonly data: ArrayBuffer) {}

  static async open(buffer: Buffer): Promise<RarArchive> {
    const data = bufferToArrayBuffer(buffer)
    try {
      // Só para validar que o arquivo é um RAR de verdade e não está
      // corrompido/criptografado — o resultado da listagem é descartado.
      const extractor = await createExtractorFromData({ data })
      const list = extractor.getFileList()
      // `fileHeaders` é um gerador preguiçoso: precisa ser consumido para
      // qualquer erro de leitura de fato ser lançado.
      for (const _header of list.fileHeaders) {
        void _header
      }
    } catch (error) {
      throw new AppError(
        'CORRUPTED_FILE',
        'errors.corruptedFile',
        error instanceof Error ? error.message : String(error),
      )
    }
    return new RarArchive(data)
  }

  async listPages(): Promise<ArchivePageEntry[]> {
    const extractor = await createExtractorFromData({ data: this.data })
    const list = extractor.getFileList()

    const sizeByName = new Map<string, number>()
    for (const header of list.fileHeaders) {
      if (header.flags.directory) continue
      sizeByName.set(header.name, header.unpSize)
    }

    const names = naturalSort([...sizeByName.keys()].filter((name) => !isIgnoredEntry(name)))
    return names.map((entryName, index) => ({
      index,
      entryName,
      size: sizeByName.get(entryName) ?? 0,
    }))
  }

  async readPage(entryName: string): Promise<Buffer> {
    const extractor = await createExtractorFromData({ data: this.data })
    const extracted = extractor.extract({ files: [entryName] })

    for (const file of extracted.files) {
      if (file.fileHeader.name === entryName && file.extraction) {
        return Buffer.from(file.extraction)
      }
    }
    throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile', `entrada ausente: ${entryName}`)
  }

  async extractAll(
    destDir: string,
    onPage: (index: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const pages = await this.listPages()
    const extractor = await createExtractorFromData({ data: this.data })
    const extracted = extractor.extract({ files: pages.map((p) => p.entryName) })

    const byName = new Map<string, Uint8Array>()
    for (const file of extracted.files) {
      if (file.extraction) byName.set(file.fileHeader.name, file.extraction)
    }

    for (const page of pages) {
      if (signal.aborted) throw new AppError('CANCELLED', 'errors.cancelled')
      const content = byName.get(page.entryName)
      if (!content) {
        throw new AppError('CORRUPTED_FILE', 'errors.corruptedFile', page.entryName)
      }
      const destFile = join(destDir, String(page.index).padStart(4, '0'))
      await writeFile(destFile, content)
      onPage(page.index)
    }
  }

  async close(): Promise<void> {
    // Nada a liberar: não há handle de SO, só o ArrayBuffer em memória
    // (coletado pelo GC quando esta instância sair de escopo).
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer
}
