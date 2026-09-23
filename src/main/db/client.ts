import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

/** Tipo do parâmetro recebido por `db.transaction(tx => ...)`, para tipar helpers internos das transações. */
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Pasta das migrations geradas pelo `drizzle-kit generate` (docs/03 §4).
 * Resolvida a partir de `__dirname`, e não de `process.cwd()`, para funcionar
 * tanto em dev quanto no build empacotado: `electron.vite.config.ts` copia
 * `src/main/db/migrations` para dentro de `out/main/` (via
 * `vite-plugin-static-copy`) precisamente para esta pasta existir ao lado do
 * `index.js` bundlado nos dois casos, sem precisar de `extraResources` no
 * electron-builder (SQL não é código: o esbuild não a enxergaria sozinho).
 */
const MIGRATIONS_FOLDER = join(__dirname, 'migrations')

/**
 * Fábrica que abre o SQLite, aplica os pragmas e roda as migrations.
 * Recebe o caminho do arquivo como parâmetro (em vez de chamar
 * `app.getPath('userData')` aqui) para continuar testável em Node puro, no
 * mesmo espírito de `src/main/utils/paths.ts`. `':memory:'` funciona e é
 * usado nos testes dos repositórios.
 */
export function createDb(dbFilePath: string): Db {
  const sqlite = new Database(dbFilePath)

  // Pragmas de docs/03-modelo-de-dados.md §4.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  const db = drizzle(sqlite, { schema })

  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  return db
}

/** Fecha a conexão SQLite (docs/02-arquitetura.md §7: chamado no `before-quit`). */
export function closeDb(db: Db): void {
  db.$client.close()
}
