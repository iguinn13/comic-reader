import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
export const libraryFolders = sqliteTable(
  'library_folders',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('idx_folders_path').on(t.path)],
)
export const comics = sqliteTable(
  'comics',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    titleNormalized: text('title_normalized').notNull(),
    format: text('format').notNull().$type<'zip' | 'rar' | 'pdf'>(),
    filePath: text('file_path').notNull(),
    dirPath: text('dir_path').notNull(),
    folderId: text('folder_id')
      .notNull()
      .references(() => libraryFolders.id, { onDelete: 'cascade' }),
    originalFileName: text('original_file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    fileHash: text('file_hash').notNull(),
    pageCount: integer('page_count').notNull(),
    coverVersion: integer('cover_version').notNull().default(0),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('idx_comics_title_norm').on(t.titleNormalized),
    index('idx_comics_created').on(t.createdAt),
    index('idx_comics_hash').on(t.fileHash),
    index('idx_comics_fav').on(t.isFavorite),
    index('idx_comics_dir').on(t.dirPath),
    uniqueIndex('idx_comics_file_path').on(t.filePath),
  ],
)
export const comicPages = sqliteTable(
  'comic_pages',
  {
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade' }),
    pageIndex: integer('page_index').notNull(),
    entryName: text('entry_name').notNull(),
    width: integer('width'),
    height: integer('height'),
  },
  (t) => [primaryKey({ columns: [t.comicId, t.pageIndex] })],
)
export const readingProgress = sqliteTable(
  'reading_progress',
  {
    comicId: text('comic_id')
      .primaryKey()
      .references(() => comics.id, { onDelete: 'cascade' }),
    currentPage: integer('current_page').notNull().default(0),
    lastReadAt: integer('last_read_at'),
    completedAt: integer('completed_at'),
    readerPrefs: text('reader_prefs'),
  },
  (t) => [
    index('idx_progress_last_read').on(t.lastReadAt),
    index('idx_progress_completed').on(t.completedAt),
  ],
)
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
