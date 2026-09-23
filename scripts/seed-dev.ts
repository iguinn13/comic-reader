/**
 * scripts/seed-dev.ts
 *
 * Popula a biblioteca com HQs falsas, para testar desempenho da grade, da
 * busca e do boot com uma biblioteca grande (RNF-02: 5.000 HQs). É só uma
 * ferramenta de desenvolvimento — nunca roda em produção, nunca é importada
 * por `src/`.
 *
 * Uso:
 *   npm run seed:dev -- --count 5000
 *   npm run seed:dev -- --count 500 --db ./tmp/seed.db
 *
 * Por padrão escreve no mesmo banco que o app usaria em desenvolvimento
 * nesta máquina, para o resultado aparecer ao rodar `npm run dev` em
 * seguida. Passe `--db` para escrever em outro arquivo, sem mexer nos seus
 * dados reais.
 *
 * Este script roda com `ELECTRON_RUN_AS_NODE=1` (mesmo motivo do `npm test`,
 * ver docs/09-testes-e-qualidade.md §1: o better-sqlite3 é compilado para o
 * ABI do Electron), então `electron`/`app` não estão disponíveis — por isso
 * `defaultUserDataDir()` abaixo replica manualmente o que
 * `app.getPath('userData')` faria.
 *
 * Não gera capas de verdade (isso depende do CoverService, que chega em M2):
 * toda HQ semeada fica com `cover_version = 0` (placeholder na grade). O
 * objetivo aqui é medir consulta/renderização de lista, não geração de imagem.
 */
import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { closeDb, createDb } from '../src/main/db/client'
import { insertComic, setFavorite } from '../src/main/db/repositories/comics'
import { markRead, setCurrentPage } from '../src/main/db/repositories/progress'
import { createAppPaths } from '../src/main/utils/paths'
// Import relativo (não @shared): este script roda via tsx fora do build do
// Vite, que é quem resolve os aliases — tsx não os enxerga aqui.
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

function parseArgs(argv: string[]): { count: number; dbPath?: string } {
  let count = 500
  let dbPath: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--count') count = Number(argv[i + 1]) || count
    if (argv[i] === '--db') dbPath = argv[i + 1]
  }
  return { count, dbPath }
}

/** Réplica mínima de `app.getPath('userData')`, ver comentário do topo. */
function defaultUserDataDir(): string {
  // "comic-reader" é o "name" de package.json, que é o que o Electron usa por
  // padrão para o nome da pasta enquanto o app não chamar `app.setName(...)`.
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

/** Mesma normalização usada na busca real (docs/03-modelo-de-dados.md §1). */
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

  for (let i = 0; i < count; i++) {
    const id = randomUUID()
    const title = titleFor(i)
    const format = FORMATS[i % FORMATS.length]

    insertComic(db, {
      id,
      title,
      titleNormalized: normalizeTitle(title),
      format,
      fileName: `${id}.${EXTENSION_BY_FORMAT[format]}`,
      originalFileName: `${title}.${EXTENSION_BY_FORMAT[format]}`,
      fileSize: 20_000_000 + Math.floor(Math.random() * 80_000_000),
      fileHash: `seed-${id}`,
      pageCount: 20 + Math.floor(Math.random() * 40),
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
      pages: [],
    })

    // Distribuição plausível de status: ~20% lidas, ~30% em andamento, resto não lida.
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
