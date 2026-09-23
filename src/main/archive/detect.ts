/**
 * Detecção de formato real por magic bytes (docs/02-arquitetura.md §3.2,
 * docs/05-importacao.md §4 passo 2). A extensão do arquivo nunca é
 * confiável — um `.cbr` pode ser, na prática, um ZIP.
 */

export type DetectedFormat = 'zip' | 'rar' | 'pdf' | 'unknown'

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // "PK\x03\x04"
const RAR_MAGIC = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) // "Rar!\x1A\x07"
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii')

/**
 * Só examina os primeiros bytes do buffer recebido — quem chama não precisa
 * carregar o arquivo inteiro em memória para detectar o formato (basta um
 * buffer com os primeiros ~16 bytes, embora um buffer maior/inteiro também
 * funcione).
 */
export function detectFormat(buffer: Buffer): DetectedFormat {
  if (startsWith(buffer, ZIP_MAGIC)) return 'zip'
  if (startsWith(buffer, RAR_MAGIC)) return 'rar'
  if (startsWith(buffer, PDF_MAGIC)) return 'pdf'
  return 'unknown'
}

function startsWith(buffer: Buffer, magic: Buffer): boolean {
  if (buffer.length < magic.length) return false
  return buffer.subarray(0, magic.length).equals(magic)
}
