# 03 — Data model

## 1. Overview

```mermaid
erDiagram
  library_folders ||--o{ comics : "contains"
  comics ||--o{ comic_pages : "has"
  comics ||--|| reading_progress : "has"

  library_folders {
    text id PK
    text path
    integer created_at
  }
  comics {
    text id PK
    text title
    text title_normalized
    text format
    text file_path
    text dir_path
    text folder_id FK
    text original_file_name
    integer file_size
    text file_hash
    integer page_count
    integer cover_version
    integer is_favorite
    integer created_at
    integer updated_at
  }
  comic_pages {
    text comic_id PK
    integer page_index PK
    text entry_name
    integer width
    integer height
  }
  reading_progress {
    text comic_id PK
    integer current_page
    integer last_read_at
    integer completed_at
    text reader_prefs
  }
  settings {
    text key PK
    text value
  }
```

Conventions:
- **IDs:** UUID v4 (`crypto.randomUUID()`), `TEXT`.
- **Dates:** epoch in milliseconds, `INTEGER`.
- **Booleans:** `INTEGER` 0/1 (Drizzle `mode: 'boolean'`).
- **`*_normalized`:** lowercase, no accents (`normalize('NFD').replace(/\p{Diacritic}/gu, '')`) and collapsed spaces. Used for search and uniqueness.

## 2. Tables

### 2.1 `library_folders`

Root folders configured by the user (RF-01/RF-03), scanned recursively by `LibraryScanService` (docs/05-importacao.md). The app never copies files: comics are read in place, from the path saved in `comics.file_path` (see the ADR in `docs/10-decisoes.md`).

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT PK | UUID |
| `path` | TEXT NOT NULL | Absolute path, `UNIQUE` |
| `created_at` | INTEGER NOT NULL | |

Index: `idx_folders_path(path)` (unique).

Removing a root folder cascades to delete all comics indexed under it (`comics.folder_id` `ON DELETE CASCADE`) — never the original files.

### 2.2 `comics`

| Column | Type | Rules |
|---|---|---|
| `id` | TEXT PK | UUID |
| `title` | TEXT NOT NULL | 1–200 characters (RF-16) |
| `title_normalized` | TEXT NOT NULL | Updated together with `title` |
| `format` | TEXT NOT NULL | `'zip' \| 'rar' \| 'pdf'`, the **real** format detected via magic bytes |
| `file_path` | TEXT NOT NULL | Absolute path of the original file, `UNIQUE`. **Never** exposed to the renderer — only IDs cross the IPC boundary (docs/02 §4) |
| `dir_path` | TEXT NOT NULL | Parent folder of `file_path`; used to find the "next file in the folder" (RF-42) |
| `folder_id` | TEXT NOT NULL FK → library_folders ON DELETE CASCADE | Root folder under which the file was found |
| `original_file_name` | TEXT NOT NULL | Original name (for display in "Details"/errors) |
| `file_size` | INTEGER NOT NULL | Bytes |
| `file_hash` | TEXT NOT NULL | SHA-1 hex of the file (RF-05), used to skip duplicates between overlapping folders |
| `page_count` | INTEGER NOT NULL | ≥ 1 |
| `cover_version` | INTEGER NOT NULL DEFAULT 0 | Incremented when the cover is (re)generated; 0 = cover not yet generated (placeholder) |
| `is_favorite` | INTEGER NOT NULL DEFAULT 0 | RF-15 |
| `created_at` | INTEGER NOT NULL | Date the comic was indexed |
| `updated_at` | INTEGER NOT NULL | |

Indexes: `idx_comics_title_norm(title_normalized)`, `idx_comics_created(created_at)`, `idx_comics_hash(file_hash)`, `idx_comics_fav(is_favorite)`, `idx_comics_dir(dir_path)`, `idx_comics_file_path(file_path)` (unique).

### 2.3 `comic_pages`

Canonical page order for CBZ/CBR. For PDF there are no rows (pdf.js provides the pages), and `page_count` comes from `pdf-lib`.

| Column | Type | Rules |
|---|---|---|
| `comic_id` | TEXT FK → comics ON DELETE CASCADE | |
| `page_index` | INTEGER | 0-based, contiguous |
| `entry_name` | TEXT NOT NULL | Path of the entry inside the archive |
| `width` | INTEGER NULL | Filled in during extraction into the cache (via `image-size`) |
| `height` | INTEGER NULL | Same |

PK: `(comic_id, page_index)`.
The dimensions are used for double-page mode (detecting wide pages) and for placeholders in vertical mode (avoiding layout jumps). While they are null, the renderer assumes a 2:3 ratio and corrects it once the image loads.

### 2.4 `reading_progress`

One row per comic, created together with the comic.

| Column | Type | Rules |
|---|---|---|
| `comic_id` | TEXT PK FK → comics ON DELETE CASCADE | |
| `current_page` | INTEGER NOT NULL DEFAULT 0 | 0-based. In double-page mode, this is the left page of the spread |
| `last_read_at` | INTEGER NULL | Updated on every progress save |
| `completed_at` | INTEGER NULL | Not null = read |
| `reader_prefs` | TEXT NULL | `ReaderPrefs` JSON (RF-41); null = uses the global defaults |

**Derived status** (RF-14), computed in SQL:
```sql
CASE
  WHEN completed_at IS NOT NULL THEN 'read'
  WHEN current_page > 0          THEN 'reading'
  ELSE 'unread'
END
```
- Manually marking as **read** (library): `completed_at = now` and `current_page = 0` (reopening starts at page 1).
- Completing the read in the reader (reaching the end): `completed_at = now`, `current_page` is kept as is (the reader opens at the last page).
- Marking as **unread**: `completed_at = NULL, current_page = 0, last_read_at = NULL`.
- Saving a page **different** from `current_page` (resuming a comic marked as read) resets `completed_at`: the comic becomes "in progress." Reopening and saving the same page does not change the status. Reaching the last page again marks it as read (RF-42).

`ReaderPrefs` (JSON, validated via zod):
```ts
type ReaderMode = 'single' | 'double' | 'vertical';
type FitMode = 'height' | 'width' | 'original';
interface ReaderPrefs {
  mode: ReaderMode;
  fit: FitMode;            // single/double
  zoom: number;            // 0.25–4.0, multiplier over the fit (single/double)
  verticalWidth: number;   // 0.2–1.0, fraction of the reading area (vertical)
  doubleOffset: boolean;   // "Shift pairs" (double)
}
```

Indexes: `idx_progress_last_read(last_read_at)`, `idx_progress_completed(completed_at)`.

### 2.5 `settings`

Key/value with `value` as JSON. The keys and defaults live in `src/shared/constants.ts`:

| Key | Type | Default | RF |
|---|---|---|---|
| `reader.defaults` | `ReaderPrefs` | `{mode:'single', fit:'height', zoom:1, verticalWidth:0.6, doubleOffset:false}` | RF-50 |
| `cache.maxBytes` | number | `2147483648` (2 GB) | RF-51 |
| `library.view` | `{sort, order, status, favoritesOnly}` | `{sort:'createdAt', order:'desc', status:'all', favoritesOnly:false}` | RF-13 |
| `ui.sidebarCollapsed` | boolean | `false` | RF-60 |
| `ui.language` | `'pt-BR' \| 'en-US'` | `'pt-BR'` | RNF-09 |
| `window.bounds` | `{x,y,width,height,maximized}` | 1280×800 centered | RF-61 |

## 3. Disk layout

Root: `app.getPath('userData')` — Windows: `%APPDATA%\Comic Reader\`; macOS: `~/Library/Application Support/Comic Reader/`; Linux: `~/.config/Comic Reader/`. All paths are built **only** in `src/main/utils/paths.ts`. There is no longer a `library/` folder: comics remain in the user's own folders, referenced via `comics.file_path`.

```
userData/
├─ comic-reader.db            # SQLite (+ -wal, -shm)
├─ covers/
│  ├─ comics/{comicId}.jpg    # 400 px wide, JPEG q=82
│  └─ folders/{key}.jpg       # cover chosen by the user for a folder with no comics; key = sha1(folderId:relativePath)
├─ cache/
│  └─ pages/{comicId}/
│     ├─ 0000.jpg|png|webp|gif      # index with 4+ digits, original extension
│     └─ .complete                  # marker: full extraction completed
└─ logs/
   └─ main.log
```

- The **cache** is disposable: deleting `cache/` never loses data.
- **Covers** are derived data from the app; they can be regenerated from the comics.
- The comics themselves **do not** live in `userData` — an app backup (database + covers) does not replace a backup of the user's folders.

## 4. Pragmas and migrations

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

- Migrations are generated via `drizzle-kit generate` and applied on boot with Drizzle's `migrate()`, reading the migrations folder bundled via electron-builder's `extraResources`.
- An already-published migration is never edited. Every change is a new migration. (One-off exception: the switch from `library`/collections to in-place folders, before the v1 release and with no production user database, consolidated the `0000` baseline — see the ADR in `docs/10-decisoes.md`.)
- Development seeds (5,000 fake comics for RNF-02) live in a separate script, `scripts/seed-dev.ts`, which never runs in production.

## 5. Main queries (reference)

**Library with filters (RF-10, RF-12, RF-13)**
```sql
SELECT c.*, p.current_page, p.last_read_at, p.completed_at, <status CASE> AS status
FROM comics c JOIN reading_progress p ON p.comic_id = c.id
WHERE (:q IS NULL OR c.title_normalized LIKE '%' || :q || '%')
  AND (:fav = 0 OR c.is_favorite = 1)
  AND (:status = 'all' OR <status CASE> = :status)
ORDER BY <c.title_normalized | c.created_at | p.last_read_at NULLS LAST> <ASC|DESC>, c.id
LIMIT :limit OFFSET :offset;
```

**Continue reading (RF-11)**
```sql
... WHERE p.completed_at IS NULL AND p.current_page > 0
ORDER BY p.last_read_at DESC LIMIT 20;
```

**Next file in the folder (RF-42)**

SQLite does not do natural ordering (`10` would come before `2`), so this is resolved in JS, not SQL: it fetches all comics with the same `dir_path`, sorts them with `naturalSort()` (`src/main/archive/natural-sort.ts`, already used to sort pages within an archive), and takes the one that comes after `file_path` in the sorted list.
```sql
SELECT id, file_path FROM comics WHERE dir_path = :dirPath;
-- sorting and "next" resolved in JS with naturalSort()
```

**Folder navigation (RF-64, docs/10 ADR-018)**

There is no intermediate folder table — only `library_folders` (root folders) and `comics.file_path`. `LibraryService.browseFolder` fetches all comics in a root folder and groups them in JS by the first segment of the path relative to the requested level (`path.relative`): one segment = a comic directly at this level; more than one = it belongs to the subfolder named by the first segment.
```sql
SELECT * FROM comics WHERE folder_id = :folderId;
-- grouping into subfolders vs. direct comics resolved in JS (path.relative + split)
```
