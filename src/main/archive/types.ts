/**
 * Interface comum dos leitores de arquivo compactado (docs/02-arquitetura.md
 * §3.2). Implementações: `ZipArchive` (yauzl) e `RarArchive` (node-unrar-js).
 * PDF não implementa esta interface: a contagem de páginas usa `pdf-lib`
 * diretamente (ver `ImportService`), e o render fica fora do escopo desta
 * tarefa (ver docs/05-importacao.md e o README de M2 no plano).
 */

export interface ArchivePageEntry {
  /** 0-based, na ordem natural já filtrada (docs/05 §5). */
  index: number
  /** Caminho completo da entrada dentro do arquivo compactado. */
  entryName: string
  /** Tamanho descomprimido em bytes, quando disponível. */
  size: number
}

export interface ComicArchive {
  /** Lista as entradas de imagem já em ordem natural, ignorando lixo. */
  listPages(): Promise<ArchivePageEntry[]>
  /** Lê o conteúdo binário de uma página. */
  readPage(entryName: string): Promise<Buffer>
  /** Extrai todas as páginas para um diretório, em ordem, reportando progresso. */
  extractAll(destDir: string, onPage: (index: number) => void, signal: AbortSignal): Promise<void>
  close(): Promise<void>
}
