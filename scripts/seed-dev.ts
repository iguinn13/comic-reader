import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { closeDb, createDb } from '../src/main/db/client'
import { insertComic, setFavorite } from '../src/main/db/repositories/comics'
import { insertLibraryFolder } from '../src/main/db/repositories/library-folders'
import { markRead, setCurrentPage } from '../src/main/db/repositories/progress'
import { createAppPaths } from '../src/main/utils/paths'
import type { ComicFormat } from '../src/shared/types'
const SAMPLE_TITLES = [
  'Batman',
  'Superman',
  'Mulher-Maravilha',
  'Flash',
  'Lanterna Verde',
  'Homem-Aranha',
  'Vingadores',
  'X-Men',
  'Quarteto Fantástico',
  'Demolidor',
  'Sandman',
  'Watchmen',
  'Hellboy',
  'Bone',
  'Saga',
  'Invencível',
  'The Walking Dead',
  'Wolverine',
  'Doutor Estranho',
  'Pantera Negra',
]
const FORMATS: readonly ComicFormat[] = ['zip', 'rar', 'pdf']
const EXTENSION_BY_FORMAT: Record<ComicFormat, string> = { zip: 'cbz', rar: 'cbr', pdf: 'pdf' }
function parseArgs(argv: string[]): {
  count: number
  dbPath?: string
} {
  let count = 500
  let dbPath: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--count') count = Number(argv[i + 1]) || count
    if (argv[i] === '--db') dbPath = argv[i + 1]
  }
  return { count, dbPath }
}
function defaultUserDataDir(): string {
  const appName = 'comic-reader'
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName)
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName)
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName)
}
function titleFor(index: number): string {
  const base = SAMPLE_TITLES[index % SAMPLE_TITLES.length]
  const issue = String((index % 300) + 1).padStart(2, '0')
  return `${base} #${issue}`
}
function normalizeTitle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
function main(): void {
  const { count, dbPath } = parseArgs(process.argv.slice(2))
  const finalDbPath = dbPath ?? createAppPaths(defaultUserDataDir()).dbFile
  mkdirSync(dirname(finalDbPath), { recursive: true })
  console.log(`Semeando ${count} HQs falsas em ${finalDbPath}...`)
  const db = createDb(finalDbPath)
  const now = Date.now()
  const folderId = randomUUID()
  const folderPath = join(homedir(), 'Comics (seed)')
  insertLibraryFolder(db, { id: folderId, path: folderPath })
  for (let i = 0; i < count; i++) {
    const id = randomUUID()
    const title = titleFor(i)
    const format = FORMATS[i % FORMATS.length]
    const originalFileName = `${title} - ${id.slice(0, 8)}.${EXTENSION_BY_FORMAT[format]}`
    insertComic(db, {
      id,
      title,
      titleNormalized: normalizeTitle(title),
      format,
      filePath: join(folderPath, originalFileName),
      dirPath: folderPath,
      folderId,
      originalFileName,
      fileSize: 20000000 + Math.floor(Math.random() * 80000000),
      fileHash: `seed-${id}`,
      pageCount: 20 + Math.floor(Math.random() * 40),
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
      pages: [],
    })
    const statusRoll = Math.random()
    if (statusRoll < 0.2) {
      setCurrentPage(db, id, 10)
      markRead(db, id)
    } else if (statusRoll < 0.5) {
      setCurrentPage(db, id, 1 + Math.floor(Math.random() * 10))
    }
    if (Math.random() < 0.1) {
      setFavorite(db, id, true)
    }
    if (i > 0 && i % 500 === 0) {
      console.log(`  ${i}/${count}...`)
    }
  }
  closeDb(db)
  console.log('Pronto.')
}
main()
