export type DetectedFormat = 'zip' | 'rar' | 'pdf' | 'unknown'
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const RAR_MAGIC = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii')
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
