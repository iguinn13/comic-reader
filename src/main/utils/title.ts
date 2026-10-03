import { extname } from 'path'
export function titleFromFileName(fileName: string): string {
  const ext = extname(fileName)
  const withoutExt = ext ? fileName.slice(0, -ext.length) : fileName
  return withoutExt.replace(/_/g, ' ').trim()
}
