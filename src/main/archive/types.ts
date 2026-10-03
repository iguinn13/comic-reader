export interface ArchivePageEntry {
  index: number
  entryName: string
  size: number
}
export interface ComicArchive {
  listPages(): Promise<ArchivePageEntry[]>
  readPage(entryName: string): Promise<Buffer>
  extractAll(destDir: string, onPage: (index: number) => void, signal: AbortSignal): Promise<void>
  close(): Promise<void>
}
