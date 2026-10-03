import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
export type Db = ReturnType<typeof drizzle<typeof schema>>
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]
const MIGRATIONS_FOLDER = join(__dirname, 'migrations')
export function createDb(dbFilePath: string): Db {
  const sqlite = new Database(dbFilePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return db
}
export function closeDb(db: Db): void {
  db.$client.close()
}
