import { extname } from 'path'

/**
 * Deriva o título de exibição a partir do nome de um arquivo: remove a
 * extensão e troca `_` por espaço (docs/09-testes-e-qualidade.md §2.2:
 * `Batman_-_Ano_Um_01.cbz` → `Batman - Ano Um 01`).
 */
export function titleFromFileName(fileName: string): string {
  const ext = extname(fileName)
  const withoutExt = ext ? fileName.slice(0, -ext.length) : fileName
  return withoutExt.replace(/_/g, ' ').trim()
}
