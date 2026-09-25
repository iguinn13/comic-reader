import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { deflateSync } from 'zlib'
import { ZipFile } from 'yazl'

function crc32(buf: Buffer): number {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return ~crc >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

/** PNG RGB com gradiente (varia por página), decodificado como bitmap cheio pelo Chromium. */
function png(width: number, height: number, seed: number): Buffer {
  const rowBytes = width * 3 + 1
  const raw = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes
    for (let x = 0; x < width; x++) {
      raw[row + 1 + x * 3] = (x + seed) & 255
      raw[row + 2 + x * 3] = (y + seed * 3) & 255
      raw[row + 3 + x * 3] = (x + y) & 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Gera um CBZ grande (docs/09 §3 fala em fixtures pequenas; este é só de teste de memória, nunca commitado). */
export async function makeBigComic(pages: number, width = 1000, height = 1500): Promise<string> {
  const zip = new ZipFile()
  for (let i = 0; i < pages; i++) {
    zip.addBuffer(png(width, height, i), `${String(i + 1).padStart(3, '0')}.png`)
  }
  zip.end()
  const chunks: Buffer[] = []
  for await (const part of zip.outputStream) chunks.push(part as Buffer)
  const file = join(mkdtempSync(join(tmpdir(), 'comic-reader-big-')), 'big.cbz')
  writeFileSync(file, Buffer.concat(chunks))
  return file
}
