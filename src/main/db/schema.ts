import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Schema Drizzle das 6 tabelas de docs/03-modelo-de-dados.md §2.
 *
 * Convenções (doc §1): ids são UUID v4 em TEXT, datas são epoch em
 * milissegundos em INTEGER, booleanos são INTEGER 0/1 (`mode: 'boolean'`).
 */

export const comics = sqliteTable(
  'comics',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    titleNormalized: text('title_normalized').notNull(),
    format: text('format').notNull().$type<'zip' | 'rar' | 'pdf'>(),
    fileName: text('file_name').notNull(),
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
  ],
)

/**
 * Ordem canônica das páginas de CBZ/CBR (doc §2.2). PDF não gera linhas aqui:
 * o `page_count` da HQ vem do `pdf-lib` e as páginas são lidas pelo pdf.js.
 */
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

/** Uma linha por HQ, criada junto com a HQ (doc §2.3). */
export const readingProgress = sqliteTable(
  'reading_progress',
  {
    comicId: text('comic_id')
      .primaryKey()
      .references(() => comics.id, { onDelete: 'cascade' }),
    currentPage: integer('current_page').notNull().default(0),
    lastReadAt: integer('last_read_at'),
    completedAt: integer('completed_at'),
    /** JSON `ReaderPrefs` (RF-41); nulo = usa os padrões globais. */
    readerPrefs: text('reader_prefs'),
  },
  (t) => [
    index('idx_progress_last_read').on(t.lastReadAt),
    index('idx_progress_completed').on(t.completedAt),
  ],
)

export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull().$type<'list' | 'saga'>(),
    name: text('name').notNull(),
    /** `UNIQUE(type, name_normalized)` — RF-20. */
    nameNormalized: text('name_normalized').notNull(),
    description: text('description'),
    coverMode: text('cover_mode').notNull().default('auto').$type<'auto' | 'image' | 'comic'>(),
    coverComicId: text('cover_comic_id').references(() => comics.id, { onDelete: 'set null' }),
    coverVersion: integer('cover_version').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('idx_collections_type_name').on(t.type, t.nameNormalized)],
)

/** PK composta impede repetição de HQ na mesma coleção (RF-23, doc §2.5). */
export const collectionItems = sqliteTable(
  'collection_items',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    comicId: text('comic_id')
      .notNull()
      .references(() => comics.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.comicId] }),
    index('idx_items_order').on(t.collectionId, t.position),
    index('idx_items_comic').on(t.comicId),
  ],
)

/** Chave/valor com `value` em JSON (doc §2.6); chaves e defaults em src/shared/constants.ts. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
