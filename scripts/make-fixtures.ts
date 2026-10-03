import { createHash } from 'crypto'
import { deflateSync } from 'zlib'
import { mkdirSync, rmSync, truncateSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument, rgb } from 'pdf-lib'
import { ZipFile } from 'yazl'
const FIXTURES_DIR = join(__dirname, '..', 'tests', 'fixtures')
function crc32(buf: Buffer): number {
  let crc = ~0
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return ~crc >>> 0
}
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}
function makeSolidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 4))
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0
    const stripe = y < height * 0.15
    for (let x = 0; x < width; x++) {
      raw[offset++] = stripe ? Math.min(255, r + 40) : r
      raw[offset++] = stripe ? Math.min(255, g + 40) : g
      raw[offset++] = stripe ? Math.min(255, b + 40) : b
      raw[offset++] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
const PORTRAIT_PAGE = (): Buffer => makeSolidPng(200, 300, [60, 90, 160])
const WIDE_PAGE = (): Buffer => makeSolidPng(400, 300, [160, 90, 60])
interface ZipEntry {
  path: string
  content: Buffer
}
function buildZip(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zip = new ZipFile()
    const chunks: Buffer[] = []
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
    for (const entry of entries) {
      zip.addBuffer(entry.content, entry.path)
    }
    zip.end()
  })
}
async function writeZipFixture(fileName: string, entries: ZipEntry[]): Promise<void> {
  const buffer = await buildZip(entries)
  writeFileSync(join(FIXTURES_DIR, fileName), buffer)
  console.log(`  ${fileName} (${entries.length} entradas, ${buffer.length} bytes)`)
}
async function makeSimplePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 300])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 200,
      height: 300,
      color: rgb(0.24 + i * 0.05, 0.35, 0.63),
    })
  }
  return Buffer.from(await doc.save())
}
const FIXTURES_README = `# Fixtures de teste

Gerados por [\`scripts/make-fixtures.ts\`](../../scripts/make-fixtures.ts) (\`npx tsx scripts/make-fixtures.ts\`). São commitados — não regenerados a cada \`npm test\`. Descrição de cada um em [docs/09-testes-e-qualidade.md §3](../../docs/09-testes-e-qualidade.md#3-fixtures).

## Faltando: \`simple-rar4.cbr\` e \`simple-rar5.cbr\`

A doc pede esses dois arquivos RAR de verdade, mas criar um RAR exige a ferramenta proprietária \`rar\` (WinRAR/RARLab) ou o \`unrar\` com suporte a criação — nenhum dos dois está disponível no ambiente onde este projeto foi desenvolvido. \`node-unrar-js\` só **lê** RAR (é um decoder WASM), não cria.

**Para adicionar esses fixtures**, numa máquina com o \`rar\` instalado:

\`\`\`bash
mkdir /tmp/rar-fixture && cd /tmp/rar-fixture
# copie 3 imagens quaisquer como 01.jpg, 02.jpg, 03.jpg
rar a -ma4 simple-rar4.cbr 01.jpg 02.jpg 03.jpg   # força o formato RAR4
rar a -ma5 simple-rar5.cbr 01.jpg 02.jpg 03.jpg   # força o formato RAR5 (default)
cp simple-rar4.cbr simple-rar5.cbr tests/fixtures/
\`\`\`

Até lá, os testes de \`RarArchive\` que dependem desses arquivos ficam marcados como pulados (\`it.skipIf\`), com um comentário apontando para este README — eles não travam o \`npm test\`, mas também não cobrem o parser RAR de verdade. A detecção de formato (\`detect.ts\`) e a estrutura da classe são testadas independentemente disso.
`
async function main(): Promise<void> {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
  mkdirSync(FIXTURES_DIR, { recursive: true })
  console.log(`Gerando fixtures em ${FIXTURES_DIR}...`)
  writeFileSync(join(FIXTURES_DIR, 'README.md'), FIXTURES_README)
  const page = PORTRAIT_PAGE()
  const wide = WIDE_PAGE()
  await writeZipFixture(
    'simple.cbz',
    Array.from({ length: 5 }, (_, i) => ({
      path: `${String(i + 1).padStart(2, '0')}.jpg`,
      content: page,
    })),
  )
  await writeZipFixture('natural-order.cbz', [
    { path: '1.jpg', content: page },
    { path: '2.jpg', content: page },
    { path: '10.jpg', content: page },
    { path: '11.jpg', content: page },
    { path: '__MACOSX/._1.jpg', content: Buffer.from('lixo') },
    { path: 'Thumbs.db', content: Buffer.from('lixo') },
  ])
  await writeZipFixture('nested-folders.cbz', [
    { path: 'cap1/1.jpg', content: page },
    { path: 'cap1/2.jpg', content: page },
    { path: 'cap2/1.jpg', content: page },
  ])
  await writeZipFixture(
    'wide-page.cbz',
    Array.from({ length: 6 }, (_, i) => ({
      path: `${String(i + 1).padStart(2, '0')}.jpg`,
      content: i === 2 ? wide : page,
    })),
  )
  await writeZipFixture('zip-as-cbr.cbr', [
    { path: '01.jpg', content: page },
    { path: '02.jpg', content: page },
    { path: '03.jpg', content: page },
  ])
  const pdfBuffer = await makeSimplePdf(3)
  writeFileSync(join(FIXTURES_DIR, 'simple.pdf'), pdfBuffer)
  console.log(`  simple.pdf (3 páginas, ${pdfBuffer.length} bytes)`)
  await writeZipFixture(
    'images-only.zip',
    Array.from({ length: 4 }, (_, i) => ({
      path: `${i + 1}.jpg`,
      content: page,
    })),
  )
  const innerCbzA = await buildZip([
    { path: '1.jpg', content: page },
    { path: '2.jpg', content: page },
  ])
  const innerCbzB = await buildZip([{ path: '1.jpg', content: page }])
  const innerCbrC = await buildZip([{ path: '1.jpg', content: page }])
  const innerPdfD = await makeSimplePdf(2)
  const innerZip = await buildZip([{ path: 'x.jpg', content: page }])
  await writeZipFixture('pack.zip', [
    { path: 'a.cbz', content: innerCbzA },
    { path: 'b.cbz', content: innerCbzB },
    { path: 'c.cbr', content: innerCbrC },
    { path: 'd.pdf', content: innerPdfD },
    { path: 'loose.jpg', content: page },
    { path: 'inner.zip', content: innerZip },
  ])
  await writeZipFixture('no-images.cbz', [
    {
      path: 'ComicInfo.xml',
      content: Buffer.from('<?xml version="1.0"?><ComicInfo><Title>Vazio</Title></ComicInfo>'),
    },
  ])
  writeFileSync(join(FIXTURES_DIR, 'not-a-comic.epub'), Buffer.from('não é uma HQ'))
  console.log('  not-a-comic.epub')
  const simpleBuffer = await buildZip(
    Array.from({ length: 5 }, (_, i) => ({
      path: `${String(i + 1).padStart(2, '0')}.jpg`,
      content: page,
    })),
  )
  const corruptedPath = join(FIXTURES_DIR, 'corrupted.cbz')
  writeFileSync(corruptedPath, simpleBuffer)
  truncateSync(corruptedPath, Math.floor(simpleBuffer.length / 2))
  console.log('  corrupted.cbz (simple.cbz truncado pela metade)')
  const hash = createHash('sha1').update(simpleBuffer).digest('hex').slice(0, 8)
  console.log(`\nFixtures gerados (simple.cbz sha1=${hash}).`)
}
main().catch((error: unknown) => {
  console.error('Falha ao gerar fixtures:', error)
  process.exitCode = 1
})
