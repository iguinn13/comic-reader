# 04 — IPC contracts

The renderer talks to the main process **exclusively** via `window.api`, defined in `src/shared/api.ts` and implemented in the preload. This contract is the system's boundary: if it changes here, update this document in the same commit.

## 1. Conventions

- **Channels:** `domain:action` (e.g., `library:list`), declared in `src/shared/channels.ts`.
- **Request/response:** `ipcRenderer.invoke` ↔ `ipcMain.handle`.
- **Main → renderer events:** `webContents.send`. The preload exposes `on<Event>(cb): () => void` (returns the unsubscribe function).
- **Validation:** every input goes through a zod schema (`src/shared/schemas.ts`) in the handler. Failure produces the `VALIDATION` error.
- **Return value:** the handler always returns `Result<T>`. The renderer's `lib/api.ts` wrapper unwraps it and throws an `AppError` for TanStack Query to handle.
- **Serialization:** only structured-clone data (no classes, no `Date`). Dates are `number` (epoch ms).
- **Images:** never go over IPC. DTOs carry ready-made `comic://` URLs.
- **File paths:** never go over IPC. The renderer only knows IDs; resolving `comics.file_path` happens entirely in the main process (docs/02-arquitetura.md §6).

## 2. Shared types (`src/shared/types.ts`)

```ts
export type ComicId = string;
export type ReadStatus = 'unread' | 'reading' | 'read';
export type ComicFormat = 'zip' | 'rar' | 'pdf';

export interface ComicSummary {
  id: ComicId;
  title: string;
  format: ComicFormat;
  pageCount: number;
  coverUrl: string | null;        // null → placeholder (cover not yet generated)
  isFavorite: boolean;
  status: ReadStatus;
  currentPage: number;            // 0-based
  progress: number;               // 0..1 = (currentPage+1)/pageCount, 1 if read
  lastReadAt: number | null;
  createdAt: number;
}

export interface ComicDetail extends ComicSummary {
  originalFileName: string;
  fileSize: number;
}

export interface LibraryQuery {
  search?: string;                                   // up to 100 chars
  sort: 'title' | 'createdAt' | 'lastReadAt';
  order: 'asc' | 'desc';
  status: 'all' | ReadStatus;
  favoritesOnly: boolean;
  limit: number;                                     // 1..500
  offset: number;
}

export interface Page<T> { items: T[]; total: number }

export interface HomeData {
  continueReading: ComicSummary[];                   // RF-11
  recentlyAdded: ComicSummary[];                      // RF-63
}

export interface LibraryFolder {
  id: string;
  path: string;
  addedAt: number;
}

export interface LibraryScanState {
  scanning: boolean;
  scanned: number;
  added: number;
  removed: number;
}

export interface DeleteComicOptions {
  deleteFile: boolean;                                // RF-17: explicit opt-in
}

export interface FolderLocation {
  folderId: string | null;                            // null = top level (lists the root folders)
  relativePath: string;                               // "" = root of the root folder; "DC/Year One" = subfolder
}

export interface FolderEntry {
  name: string;                                       // display name (folder basename)
  folderId: string;
  relativePath: string;
  comicCount: number;                                 // recursive
  coverUrl: string | null;                            // cover of the 1st comic directly in the folder; with no direct comics, the user-chosen image (ADR-020) or null
  hasDirectComics: boolean;                           // only folders with no direct comics accept their own cover
}

export interface FolderContents {
  subfolders: FolderEntry[];
  comics: ComicSummary[];                              // at the top level: only loose comics from root folders that have subfolders
}
```

The reader types (`ReaderPrefs`, `ReaderMode`, `FitMode`) are defined in [03 §2.4](03-modelo-de-dados.md#24-reading_progress).

```ts
export interface ReaderPage {
  index: number;
  url: string;                                       // comic://page/{id}/{index}
  width: number | null;
  height: number | null;
}

export interface ReaderSession {
  comic: ComicDetail;
  source:                                            // how to render
    | { kind: 'images'; pages: ReaderPage[] }        // CBZ/CBR
    | { kind: 'pdf'; fileUrl: string };              // comic://file/{id}
  currentPage: number;
  prefs: ReaderPrefs;                                // already merged: comic prefs ?? defaults
  hasCustomPrefs: boolean;
  nextInFolder: ComicSummary | null;                 // next file (natural order) in the same folder (RF-42)
}
```

## 3. Errors

```ts
export type AppErrorCode =
  | 'VALIDATION'           // invalid input
  | 'NOT_FOUND'            // nonexistent id
  | 'CONFLICT'             // e.g., root folder already configured
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'       // file won't open / has no pages
  | 'FILE_MISSING'         // file disappeared from the user's folder
  | 'IO'                   // disk error (no space, permission)
  | 'CANCELLED'
  | 'INTERNAL';

export interface AppErrorPayload { code: AppErrorCode; message: string; details?: unknown }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload };
```

`message` is an **i18n key** (e.g., `errors.fileMissing`) and the renderer translates it. `INTERNAL` is always logged with a stack trace in the main process.

## 4. API (`window.api`)

### 4.1 `library`
| Method | Channel | Input | Output | RF |
|---|---|---|---|---|
| `home()` | `library:home` | — | `HomeData` | RF-11, RF-63 |
| `list(q)` | `library:list` | `LibraryQuery` | `Page<ComicSummary>` | RF-10, 12, 13, 15 |
| `get(id)` | `library:get` | `ComicId` | `ComicDetail` | — |
| `rename(id, title)` | `library:rename` | `ComicId, string(1..200)` | `ComicSummary` | RF-16 |
| `setFavorite(ids, value)` | `library:setFavorite` | `ComicId[] (1..1000), boolean` | `void` | RF-15 |
| `setReadStatus(ids, status)` | `library:setReadStatus` | `ComicId[], 'read'\|'unread'` | `void` | RF-14 |
| `removeFromContinue(id)` | `library:removeFromContinue` | `ComicId` | `void` | RF-11 |
| `delete(ids, options)` | `library:delete` | `ComicId[] (1..1000), DeleteComicOptions` | `{ deleted: number }` | RF-17 |
| `stats()` | `library:stats` | — | `{ comicCount; libraryBytes; cacheBytes }` | RF-51, 52 |
| `scan()` | `library:scan` | — | `void` | RF-04 ("Refresh library") |
| `browseFolder(location)` | `library:browseFolder` | `FolderLocation` | `FolderContents` | RF-64 |
| `setFolderCover(location)` | `library:setFolderCover` | `FolderLocation` (`folderId` ≠ null) | `boolean` (false = the image picker was cancelled) | RF-64 |
| `clearFolderCover(location)` | `library:clearFolderCover` | `FolderLocation` (`folderId` ≠ null) | `void` | RF-64 |

`delete` with `deleteFile: true` only deletes the file from disk if it is still within a configured root folder (safety check in `LibraryService`); otherwise, the file is preserved and only the record is removed, silently.

`browseFolder` has no subfolder table: it groups the root folder's comics in memory by the first segment of the path relative to `relativePath` (docs/10 ADR-018). With `folderId: null`, it returns, for each root folder that has subfolders, those subfolders (and its loose comics in `comics`); for a root folder with no subfolders, itself as a `subfolder`.

**Events**
| Event | Payload | When |
|---|---|---|
| `onScanProgress(cb)` | `LibraryScanState` | On every file scanned, and on completion |
| `onChanged(cb)` | `{ reason: 'scan' \| 'delete' \| 'cover' }` | Comics indexed/removed/cover generated → renderer invalidates queries |

### 4.2 `libraryFolders`
| Method | Channel | Input | Output | RF |
|---|---|---|---|---|
| `list()` | `libraryFolders:list` | — | `LibraryFolder[]` | RF-01, 03 |
| `add()` | `libraryFolders:add` | — | `LibraryFolder \| null` (`null` = dialog cancelled) | RF-01 |
| `remove(id)` | `libraryFolders:remove` | `string` (UUID) | `void` | RF-03 |

`add` opens the native folder-picker dialog (`dialog.showOpenDialog({ properties: ['openDirectory'] })`) and, upon confirmation, triggers and **awaits** a full scan before resolving — the UI can already query `library:list` on return. A repeated folder returns `CONFLICT`.

### 4.3 `reader`
| Method | Channel | Input | Output | RF |
|---|---|---|---|---|
| `open(comicId)` | `reader:open` | `ComicId` | `ReaderSession` | RF-30, 41, 42 |
| `setPage(comicId, page)` | `reader:setPage` | `ComicId, int ≥ 0` | `void` (*fire-and-forget*, see below) | RF-40 |
| `savePrefs(comicId, prefs)` | `reader:savePrefs` | `ComicId, ReaderPrefs` | `void` | RF-41 |
| `resetPrefs(comicId)` | `reader:resetPrefs` | `ComicId` | `ReaderPrefs` (defaults) | RF-41 |
| `complete(comicId)` | `reader:complete` | `ComicId` | `void` | RF-42 |
| `reportPageSize(comicId, index, w, h)` | `reader:reportPageSize` | — | `void` | Dimensions for PDF pages or unmeasured pages |
| `close(comicId)` | `reader:close` | `ComicId` | `void` | immediate progress flush |

**`setPage` semantics:** the renderer calls this on every page change (no debounce). The main process holds the value in memory and writes it to the database with a 500 ms debounce per comic. `close`, `before-quit`, and `render-process-gone` force the flush. This satisfies RF-40 and RNF-12.

`open` triggers extraction of the comic into the cache in the background (`PageCacheService.ensure(comicId)`), prioritizing the current page and the following ones. If the file no longer exists in the user's folder, it returns `FILE_MISSING`, and if it won't open, `CORRUPTED_FILE` (RF-62).

### 4.4 `settings`
| Method | Channel | Input | Output |
|---|---|---|---|
| `get()` | `settings:get` | — | `Settings` (all keys with defaults applied) |
| `update(patch)` | `settings:update` | `Partial<Settings>` (validated per key) | `Settings` |
| `resetAllReaderPrefs()` | `settings:resetAllReaderPrefs` | — | `void` (RF-50 "Apply to all") |

### 4.5 `app`
| Method | Channel | Output |
|---|---|---|
| `info()` | `app:info` | `{ version; userDataPath }` |
| `openDataFolder()` | `app:openDataFolder` | `void` (`shell.openPath`) |
| `clearCache()` | `app:clearCache` | `{ freedBytes }` |
| `toggleFullscreen(force?: boolean)` | `app:toggleFullscreen` | `boolean` (new state; with `force`, sets the state instead of toggling) |
| `onFullscreenChanged(cb)` | event | `boolean` |

## 5. Implementation example (pattern to follow)

```ts
// src/main/ipc/library.ts
export function registerLibraryIpc(svc: LibraryService) {
  handle(CH.library.rename, z.tuple([zComicId, zTitle]), ([id, title]) => svc.rename(id, title));
}

// src/main/ipc/handle.ts
export function handle<I, O>(channel: string, schema: ZodType<I>, fn: (input: I) => O | Promise<O>) {
  ipcMain.handle(channel, async (_e, ...args): Promise<Result<O>> => {
    const parsed = schema.safeParse(args);
    if (!parsed.success) return err('VALIDATION', 'errors.validation', parsed.error.flatten());
    try { return ok(await fn(parsed.data)); }
    catch (e) { return toResult(e); }  // AppError → error; everything else → INTERNAL + log
  });
}

// src/preload/index.ts
const api: ComicReaderApi = {
  library: { rename: (id, title) => ipcRenderer.invoke(CH.library.rename, id, title), /* ... */ },
  // ...
};
contextBridge.exposeInMainWorld('api', api);
```
