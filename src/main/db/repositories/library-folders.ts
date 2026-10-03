import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { libraryFolders } from '../schema'
export interface LibraryFolderRow {
  id: string
  path: string
  createdAt: number
}
export function listLibraryFolders(db: Db): LibraryFolderRow[] {
  return db.select().from(libraryFolders).all()
}
export function getLibraryFolder(db: Db, id: string): LibraryFolderRow | null {
  const row = db.select().from(libraryFolders).where(eq(libraryFolders.id, id)).get()
  return row ?? null
}
export function getLibraryFolderByPath(db: Db, path: string): LibraryFolderRow | null {
  const row = db.select().from(libraryFolders).where(eq(libraryFolders.path, path)).get()
  return row ?? null
}
export function insertLibraryFolder(
  db: Db,
  input: {
    id: string
    path: string
  },
): void {
  db.insert(libraryFolders).values({ id: input.id, path: input.path, createdAt: Date.now() }).run()
}
export function deleteLibraryFolder(db: Db, id: string): void {
  db.delete(libraryFolders).where(eq(libraryFolders.id, id)).run()
}
