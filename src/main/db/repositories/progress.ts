import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { ReaderPrefs } from '@shared/types'
import type { Db } from '../client'
import { comics, readingProgress } from '../schema'
import { comicColumns, type ComicRow } from './comics'

export interface ProgressRow {
  comicId: string
  currentPage: number
  lastReadAt: number | null
  completedAt: number | null
  readerPrefs: string | null
}

/** `null` quando a HQ não existe (não deveria acontecer: toda HQ tem progresso desde a importação). */
export function getProgress(db: Db, comicId: string): ProgressRow | null {
  const row = db.select().from(readingProgress).where(eq(readingProgress.comicId, comicId)).get()

  return row ?? null
}

/**
 * Avança/retrocede a página atual. Se a página mudou, remove a marca de lida:
 * voltar a ler uma HQ lida a deixa "em andamento" (docs/03 §2.3). Reabrir e
 * salvar a mesma página não altera o status. No SQLite o lado direito do
 * UPDATE enxerga os valores antigos, então `current_page` ainda é o anterior.
 */
export function setCurrentPage(db: Db, comicId: string, page: number): void {
  db.update(readingProgress)
    .set({
      currentPage: page,
      lastReadAt: Date.now(),
      completedAt: sql`CASE WHEN ${readingProgress.currentPage} <> ${page} THEN NULL ELSE ${readingProgress.completedAt} END`,
    })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** `current_page` é mantido: reabrir continua de onde estava (docs/03 §2.3). */
export function markRead(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: Date.now() })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** Marcação manual (biblioteca): além de lida, volta para a 1ª página (docs/03 §2.3). */
export function markReadAndRewind(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: Date.now(), currentPage: 0 })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** Zera o progresso por completo (docs/03 §2.3). */
export function markUnread(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ completedAt: null, currentPage: 0, lastReadAt: null })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** RF-11: em andamento, mais recentes primeiro (docs/03 §5). */
export function getContinueReading(db: Db, limit: number): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .where(and(isNull(readingProgress.completedAt), gt(readingProgress.currentPage, 0)))
    .orderBy(desc(readingProgress.lastReadAt))
    .limit(limit)
    .all()
}

/** RF-63: últimas HQs adicionadas, mais recentes primeiro. */
export function getRecentlyAdded(db: Db, limit: number): ComicRow[] {
  return db
    .select(comicColumns)
    .from(comics)
    .innerJoin(readingProgress, eq(readingProgress.comicId, comics.id))
    .orderBy(desc(comics.createdAt), asc(comics.id))
    .limit(limit)
    .all()
}

/** RF-50 "Aplicar a todas as HQs": limpa as preferências de leitura salvas por HQ. */
export function resetAllReaderPrefs(db: Db): void {
  db.update(readingProgress).set({ readerPrefs: null }).run()
}

/** `null` = a HQ ainda usa os padrões globais (docs/03 §2.3, RF-41). */
export function getReaderPrefs(db: Db, comicId: string): ReaderPrefs | null {
  const row = db
    .select({ readerPrefs: readingProgress.readerPrefs })
    .from(readingProgress)
    .where(eq(readingProgress.comicId, comicId))
    .get()
  return row?.readerPrefs ? (JSON.parse(row.readerPrefs) as ReaderPrefs) : null
}

/** RF-41: preferências específicas desta HQ, sobrepondo os padrões globais. */
export function setReaderPrefs(db: Db, comicId: string, prefs: ReaderPrefs): void {
  db.update(readingProgress)
    .set({ readerPrefs: JSON.stringify(prefs) })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}

/** "Restaurar padrões de leitura" no menu `⋯` do leitor (RF-41): volta esta HQ aos padrões globais. */
export function resetReaderPrefs(db: Db, comicId: string): void {
  db.update(readingProgress)
    .set({ readerPrefs: null })
    .where(eq(readingProgress.comicId, comicId))
    .run()
}
