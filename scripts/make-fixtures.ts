/**
 * scripts/make-fixtures.ts
 *
 * Gera os arquivos de teste de tests/fixtures/ (docs/09-testes-e-qualidade.md
 * §3), usados pelos testes de src/main/archive/ e do ImportService. Roda uma
 * vez (ou sempre que os fixtures precisarem mudar) e os resultados ficam
 * commitados — não é gerado a cada `npm test`.
 *
 * Uso: npx tsx scripts/make-fixtures.ts
 *
 * As "imagens" de página são PNGs simples (cor sólida + um retângulo, sem
 * texto) gerados aqui mesmo com zlib puro — sem precisar de sharp/canvas —
 * mas salvos com extensão `.jpg`/`.png` conforme o nome pedido pela doc. Isso
 * é suficiente para testar ordenação, filtragem e leitura de dimensões (que
 * o `image-size` faz por assinatura do arquivo, não pela extensão); não são
 * fotos de HQ de verdade, e não precisam ser.
 *
 * RAR (simple-rar4.cbr / simple-rar5.cbr): não gerados por este script. Criar
 * um RAR de verdade exige a ferramenta proprietária `rar` (WinRAR/RARLab),
 * que não está disponível neste ambiente. Ver tests/fixtures/README.md.
 */
import { createHash } from 'crypto'
import { deflateSync } from 'zlib'
import { mkdirSync, rmSync, truncateSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument, rgb } from 'pdf-lib'
import { ZipFile } from 'yazl'

const FIXTURES_DIR = join(__dirname, '..', 'tests', 'fixtures')

// ---------------------------------------------------------------------------
// PNG mínimo, sem dependências além de zlib (mesma técnica do ícone do app).
// ---------------------------------------------------------------------------

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

/** Gera um PNG RGBA sólido de `width`×`height`, com uma faixa mais clara no topo (só para não ser um bloco 100% uniforme). */
function makeSolidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 4))
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0 // filtro "none" por linha
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
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
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

// ---------------------------------------------------------------------------
// ZIP (via yazl) — usado para todos os .cbz/.zip/.cbr "que na verdade é zip".
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PDF (via pdf-lib) — simple.pdf.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// README.md do diretório de fixtures. Escrito aqui (e não mantido à mão ao
// lado dos fixtures) porque `main()` apaga o diretório inteiro a cada
// execução — um arquivo solto ali se perderia na primeira regeneração.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Geração de todos os fixtures.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
  mkdirSync(FIXTURES_DIR, { recursive: true })
  console.log(`Gerando fixtures em ${FIXTURES_DIR}...`)

  writeFileSync(join(FIXTURES_DIR, 'README.md'), FIXTURES_README)

  const page = PORTRAIT_PAGE()
  const wide = WIDE_PAGE()

  // simple.cbz — 5 páginas em ordem.
  await writeZipFixture(
    'simple.cbz',
    Array.from({ length: 5 }, (_, i) => ({
      path: `${String(i + 1).padStart(2, '0')}.jpg`,
      content: page,
    })),
  )

  // natural-order.cbz — testa natural sort e o filtro de lixo (docs/05 §5).
  await writeZipFixture('natural-order.cbz', [
    { path: '1.jpg', content: page },
    { path: '2.jpg', content: page },
    { path: '10.jpg', content: page },
    { path: '11.jpg', content: page },
    { path: '__MACOSX/._1.jpg', content: Buffer.from('lixo') },
    { path: 'Thumbs.db', content: Buffer.from('lixo') },
  ])

  // nested-folders.cbz — páginas em subpastas, ordem natural do caminho completo.
  await writeZipFixture('nested-folders.cbz', [
    { path: 'cap1/1.jpg', content: page },
    { path: 'cap1/2.jpg', content: page },
    { path: 'cap2/1.jpg', content: page },
  ])

  // wide-page.cbz — 6 páginas, a 3ª larga (para o modo página dupla, RF-32).
  await writeZipFixture(
    'wide-page.cbz',
    Array.from({ length: 6 }, (_, i) => ({
      path: `${String(i + 1).padStart(2, '0')}.jpg`,
      content: i === 2 ? wide : page,
    })),
  )

  // zip-as-cbr.cbr — ZIP de verdade com extensão .cbr (caso comum, docs/05 §2).
  await writeZipFixture('zip-as-cbr.cbr', [
    { path: '01.jpg', content: page },
    { path: '02.jpg', content: page },
    { path: '03.jpg', content: page },
  ])

  // simple.pdf — 3 páginas.
  const pdfBuffer = await makeSimplePdf(3)
  writeFileSync(join(FIXTURES_DIR, 'simple.pdf'), pdfBuffer)
  console.log(`  simple.pdf (3 páginas, ${pdfBuffer.length} bytes)`)

  // images-only.zip — só imagens, vira 1 HQ (docs/05 §3).
  await writeZipFixture(
    'images-only.zip',
    Array.from({ length: 4 }, (_, i) => ({
      path: `${i + 1}.jpg`,
      content: page,
    })),
  )

  // pack.zip — várias HQs + imagem solta + zip aninhado não suportado (docs/05 §3).
  const innerCbzA = await buildZip([
    { path: '1.jpg', content: page },
    { path: '2.jpg', content: page },
  ])
  const innerCbzB = await buildZip([{ path: '1.jpg', content: page }])
  // c.cbr: ZIP com extensão .cbr — mesmo truque de zip-as-cbr.cbr, já que
  // gerar um RAR de verdade não é possível neste ambiente (ver topo do arquivo).
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

  // no-images.cbz — só metadado, sem página nenhuma (docs/05 §9 caso 9).
  await writeZipFixture('no-images.cbz', [
    {
      path: 'ComicInfo.xml',
      content: Buffer.from('<?xml version="1.0"?><ComicInfo><Title>Vazio</Title></ComicInfo>'),
    },
  ])

  // not-a-comic.epub — extensão não suportada (docs/05 §9 caso 12).
  writeFileSync(join(FIXTURES_DIR, 'not-a-comic.epub'), Buffer.from('não é uma HQ'))
  console.log('  not-a-comic.epub')

  // corrupted.cbz — o mesmo conteúdo de simple.cbz, truncado pela metade
  // (docs/05 §9 caso 8). Reconstrói o buffer em vez de reler do disco.
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
