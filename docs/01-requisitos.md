# 01 — Requirements

## 1. Vision

A desktop comic reader, **offline and local**, built for the fan who already organizes their CBZ/CBR/PDF files in folders on their computer. The user just points the app at one or more root folders — scanned recursively, including subfolders — and the app indexes the comics found there, without copying them: organizing into folders remains the user's job, outside the app (similar to Windows' "Cover"). The app only takes care of comfortable reading and progress tracking.

**Principles**

1. **Reading first:** opening and reading a comic should be fast and frictionless, and the app remembers where you left off.
2. **Clean and dark:** minimalist, dark visuals, with comic covers as the protagonist.
3. **Local and private:** no account, no server, no telemetry.

## 2. Scope

### In scope (v1)
- Pointing to one or more root folders (CBZ, CBR, PDF, and ZIP), scanned recursively.
- Reading in three modes: single page, double page, and continuous vertical, with zoom and fullscreen.
- Automatically saving progress and offering the "Continue reading" section.
- When finishing a comic, suggesting the next file (natural order) from the same folder.
- Searching, filtering, and sorting the library, with read/unread status and favorites.
- Bilingual interface (pt-BR default, en-US) via i18next, with a selector in Settings.
- Packaging for Windows 10/11 x64, macOS (x64/arm64), and Linux x64 (AppImage/deb).

### Out of scope
- Social network features, comments, sharing.
- Login, accounts, cloud sync.
- Light mode.
- Manual organization into lists/sagas/collections — organization is the user's own folder structure (see `docs/10-decisoes.md`).
- Folder-tree navigation in the UI — the library is a single list/grid (see §4.2).
- Right-to-left reading (manga). **(v2)**
- CB7/7z, CBT, EPUB formats, image folders. **(v2)**
- Reading `ComicInfo.xml` metadata. **(v2)**
- Downloading/scraping comics or metadata from the internet.
- Editing comic images.
- Real-time folder monitoring (file watcher). **(v2)** — the app scans on boot and on demand.
- Auto-update. **(v2)**

## 3. Personas

- **Collector reader:** has hundreds or thousands of files already organized into folders by saga/arc and wants to resume reading without hunting for the page.
- **Casual reader:** points the app at the folder where they already keep their comics and just wants to open and read comfortably, often fullscreen at night.

## 4. Functional requirements

Convention: each requirement has a stable ID `RF-xx` and acceptance criteria in *Given / When / Then* format. Priority: **P1** (mandatory for v1) and **P2** (desirable for v1, may slip to the end of the schedule).

### 4.1 Library folders

Full detail of the scan algorithm in [05-importacao.md](05-importacao.md).

**RF-01 — Add root folder (P1)**
The user adds a root folder from the Settings screen (or from the empty state of Library/Home), which opens the native folder-picker dialog.
- Given the user picks a folder, when they confirm the dialog, then the folder is saved and scanned immediately.
- Given the user cancels the dialog, then nothing happens.
- Adding an already-configured folder does not duplicate it (silent error in the UI).

**RF-02 — Recursive scanning (P1)**
Each root folder is walked recursively — "it may be chained," i.e., subfolders inside subfolders — looking for `.cbz`, `.cbr`, `.pdf`, and `.zip` files.
- Given a `.zip` file containing only images, when scanned, then it is treated as a single comic (equivalent to a CBZ).
- Files with an unrecognized extension, or corrupted/empty files, are silently ignored (internal log, without interrupting the scan).

**RF-03 — Multiple root folders (P1)**
The user can configure several independent root folders (e.g., an HDD and an SSD) and remove them at any time from the Settings screen.
- Removing a root folder takes all comics found in it out of the index (never deletes the original files) — see RF-06.

**RF-04 — Automatic and manual update (P1)**
All root folders are automatically re-scanned when the app opens, and the user can force an update at any time via the "Refresh library" button in the sidebar.
- A comic whose file has disappeared from a folder since the last scan is silently removed from the index (progress, cover, and cache are also cleared).
- The scan runs in the background; the user can keep browsing and reading during the scan.

**RF-05 — Duplicate detection (P1)**
A comic is a duplicate if the file's SHA-1 hash already exists in the library (for example, the same file reachable through two overlapping root folders).
- Given a duplicate file, when found during the scan, then it is silently ignored (no dialog — the scan is automatic and non-interactive); the first indexed occurrence is the one that remains.

**RF-06 — In-place indexing (P1)**
Comics are never copied, moved, or altered: the app reads the original file in place.
- The initial title is the file name without the extension, with repeated `_` and `.` characters replaced with spaces and trimmed spaces.
- A cover (thumbnail of the first page) is generated and kept separately, in the app's data folder.
- Given the user moves or renames the original file outside the app, then the comic disappears from the index on the next scan (nothing breaks; a new scan finds the file at the new path as a "new" comic).

### 4.2 Library

**RF-10 — Library: all comics (P1)**
The "Library" screen displays all comics in a (virtualized) cover grid with title, progress bar (if in progress), a "Read" badge, and a favorite icon.
- Clicking the card opens the comic in the reader, at the saved page.

**RF-11 — Continue reading (P1)**
The "Home" screen shows a "Continue reading" row with comics **in progress** (current page > 0 and not read), ordered by last read (most recent first), with a maximum of 20 items.
- Given the user finished a comic, then it leaves the row.
- Each card in the row can be removed from the row via "Remove from Continue reading." This resets progress to 0 (the comic goes back to "unread").

**RF-12 — Search (P1)**
Search field in the Library that filters by title, case- and accent-insensitive ("acao" finds "Ação"), with a 200 ms debounce.

**RF-13 — Sorting and filters (P1)**
- Sort by: **Title (A–Z / Z–A)**, **Recently added** (default), **Recently read**.
- Filter by status: **All / Unread / In progress / Read**, and by **Favorites only**.
- The sort/filter choice persists between sessions.

**RF-14 — Read status (P1)**
Every comic has a derived status: **unread** (page 0 and never completed), **in progress** (page > 0, not completed), or **read** (completed).
- The comic automatically becomes "read" upon reaching the last page (see RF-42).
- Going back to read a comic marked as read (changing the page) removes the read status and leaves it **in progress**, until it reaches the last page again.
- The user can manually mark as **read** or **unread** (one or several). "Unread" resets progress.

**RF-15 — Favorites (P1)**
The user can favorite/unfavorite a comic from the card, context menu, or reader. The sidebar has a "Favorites" entry, with the grid of favorite comics (same controls as the Library).

**RF-16 — Rename comic (P1)**
The user can edit a comic's display title. The file on disk does not change. The title cannot be empty (max. 200 characters).

**RF-17 — Delete comic (P1)**
The user can delete one or several comics, with a confirmation dialog and an explicit **"Also delete the file from disk"** option, unchecked by default.
- Without the option checked: removes the record, the cover, and the page cache; the original file remains in the user's folder and reappears on the next scan, unless the root folder is removed first (RF-03).
- With the option checked: in addition to the above, deletes the original file from disk — only if it is still within a configured root folder (safety check; otherwise, the file is preserved and only the record is removed).

**RF-18 — Multiple selection (P1)**
In the comic grids, several comics can be selected (checkbox on hover, `Ctrl+click`, `Shift+click` for a range, `Ctrl+A`). With a selection active, an action bar shows: *Mark as read*, *Mark as unread*, *Favorite*, *Delete*, *Cancel selection* (`Esc`).

**RF-19 — Card context menu (P1)**
Right-click (or the "⋯" button on hover) on a comic card: *Read*, *Mark as read/unread*, *Favorite/Unfavorite*, *Rename*, *Delete*.

**RF-64 — Folder navigation (P1)**
The Library has two views, toggled by a button: **Folders** (default) and **All comics** (the single grid with search/filters/sorting from RF-10..13).
- In **Folders**, the screen shows the user's own folder structure: at the top level, each configured root folder (RF-01/RF-03) that has subfolders does not appear itself — only its children (and its loose comics); a root folder with no subfolders appears by itself. Inside a folder, the subfolders (with their comic count) and the comics directly in it appear in the same grid — clicking a subfolder enters it, with a breadcrumb at the top to go back.
- A folder with no subfolders and no comics shows a simple empty state.
- This navigation is read-only: creating/renaming/moving folders remains something the user does outside the app (docs/10 ADR).

### 4.4 Reader

Full detail in [06-leitor.md](06-leitor.md).

**RF-30 — Open comic (P1)**
Opening a comic shows the reader at the **saved page**, with the mode and zoom remembered for that comic (or the global defaults).

**RF-31 — Single page mode (P1)**
One page at a time, with the *Fit to height* (default), *Fit to width*, and *Original size* adjustments.

**RF-32 — Double page mode (P1)**
Two pages side by side. The cover (page 1) stands alone, and wide pages (width > height) stand alone. A "Shift pairs" option fixes misaligned spreads.

**RF-33 — Continuous vertical / "zoomed portrait" mode (P1)**
Pages are stacked vertically, with continuous scrolling (webtoon-style). The **column width** is adjustable (20%–100% of the reading area, default 60%) and is remembered per comic. This is the mode for comfortably "reading zoomed in."

**RF-34 — Zoom (P1)**
In page modes: zoom from 25% to 400% via `Ctrl+wheel`, `+`/`-`, and buttons, with reset (`0`). When zoomed beyond the viewing area, the page can be dragged (pan). In vertical mode, zoom changes the column width.

**RF-35 — Keyboard navigation (P1)**
Left/right arrows change the page (or spread), plus the other shortcuts in the [reader table](06-leitor.md#5-keyboard-shortcuts).

**RF-36 — Mouse navigation (P1)**
Clicking the left/right zone of the page goes back/forward, the mouse wheel navigates, the mouse's side buttons (back/forward) change pages, and there are visible arrow buttons in the reader bar.

**RF-37 — Fullscreen (P1)**
Toggle fullscreen with `F11`/`F` or a button, and exit with `Esc`.

**RF-38 — (removed)** Focus mode dropped, see ADR-019.

**RF-39 — Page indicator and jump (P1)**
Bottom bar with a progress slider, "page X of Y," and a "Go to page" field. `Home`/`End` go to the first/last page.

**RF-40 — Automatic progress saving (P1)**
The current page is persisted on every change and guaranteed on closing the reader, closing the app, or a renderer crash. Reopening the app brings the comic back to the same page.

**RF-41 — Per-comic preferences (P1)**
The reading mode, fit/zoom, and vertical width chosen for a comic are remembered for it. Comics never opened use the global defaults (RF-50).

**RF-42 — End of comic (P1)**
- When showing the last page (or last spread; in vertical mode, upon scrolling to the end), the comic is marked as **read**.
- Trying to advance past the last page shows the end panel: "You finished *Title*," with **"Continue: *Next file's title*"** (if there is another file in the same folder, in natural order, after the current one), "Back to library," and "Keep reading here."
- The "next file" is purely positional (natural order of file names within the folder) — it does not depend on any manual organization by the user.

**RF-43 — Preloading (P1)**
Neighboring pages are preloaded so that changing pages is instantaneous (see RNF-01).

**RF-44 — Comic actions inside the reader (P2)**
Favoriting is also accessible from the reader's top bar.

### 4.5 Settings

**RF-50 — Reading defaults (P1)**
Default reading mode, default fit (single page), default vertical width, and "Apply to all comics" (clears per-comic preferences).

**RF-51 — Cache (P1)**
Shows the current page cache usage, allows setting the limit (512 MB – 20 GB, default 2 GB), and a "Clear cache" button.

**RF-52 — Library on disk (P1)**
Shows the total library size and the number of comics, with an "Open data folder" button.

**RF-53 — About (P2)**
App version and data folder path.

### 4.6 General / Shell

**RF-60 — Sidebar (P1)**
Fixed left-hand menu with: **Home**, **Library**, **Favorites**, a **Refresh library** button (re-scans the root folders, RF-04), and **Settings** (footer, where root folders live, RF-01/03). Can be collapsed to icons (button or `Ctrl+B`), and the state persists. The active item is highlighted.

**RF-61 — Window state (P1)**
The window's size, position, and maximized state are restored when reopening. The minimum window size is 960×600.

**RF-62 — Empty and error states (P1)**
Every screen has an empty state with guidance (e.g., empty library → "Drag your comics here or click Import"). A comic whose file disappeared or is corrupted shows an error in the reader with the option "Remove from library."

**RF-63 — Home screen (P1)**
Contains: "Continue reading" (RF-11) and "Recently added" (last 20 comics).

## 5. Non-functional requirements

| ID | Category | Requirement | How to measure |
|---|---|---|---|
| RNF-01 | Performance | Page change < 100 ms with preloading. First page of a CBZ up to 150 MB visible in < 2 s on first open, and < 500 ms when already cached. | Timing logs in dev + manual test with a large fixture |
| RNF-02 | Scale | Library with 5,000 comics: grid scrolling at 60 fps (virtualized), search/filter responding in < 200 ms, and boot to the Home screen in < 3 s. | Seed script with 5,000 records |
| RNF-03 | Memory | Renderer < 600 MB when reading a 300-page comic in vertical mode (virtualization: only nearby pages mounted in the DOM). | Task manager / `process.getProcessMemoryInfo` |
| RNF-04 | Fluidity | Vertical mode and grid scrolling at 60 fps on mid-range hardware (i5, 8 GB, SSD). | DevTools Performance |
| RNF-05 | Robustness | A failure on one file does not interrupt the scan. Database operations touching several tables are transactional. Boot cleans up orphaned covers (with no matching comic) and removes from the index comics whose file disappeared from the folder. | Unit tests + interrupted-scan test |
| RNF-06 | Security | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, no `remote`, every IPC input validated with zod, and file paths never built from renderer strings (only IDs). | Checklist in [02-arquitetura.md](02-arquitetura.md#6-security) |
| RNF-07 | Privacy | 100% offline, no network requests, and no telemetry. Fonts and icons bundled locally. | CSP `connect-src` with no external hosts |
| RNF-08 | Responsiveness | Functional layout from 960×600 up to 4K. The grid adjusts columns automatically and the sidebar collapses on its own below 1100 px width. | Manual test by resizing |
| RNF-09 | i18n | No hardcoded UI text: everything lives in `locales/{pt-BR,en-US}.json` via i18next, with key parity guaranteed by a test (`src/renderer/src/i18n/locales.test.ts`). pt-BR is the default language; the user switches it in Settings, without needing to restart the app. Dates and numbers formatted with `Intl` in the active language. | Automated test + review |
| RNF-10 | Accessibility | Visible keyboard focus, text contrast ≥ AA (4.5:1), all controls reachable by keyboard, `aria-label` on icon-only buttons. | Review + axe in DevTools |
| RNF-11 | Platform | Windows 10/11 x64 (NSIS, with a Start menu shortcut), macOS 12+ (dmg/zip, x64 and arm64), and Linux x64 (AppImage/deb). The code must not use platform-exclusive APIs without abstraction (`process.platform` isolated to specific, documented points). Unsigned builds: SmartScreen/Gatekeeper warn the user on first run. | CI build (Windows/macOS/Linux matrix) |
| RNF-12 | Integrity | Database writes use WAL. A power loss during reading loses at most 1 s of progress. | Review |
| RNF-13 | Maintainability | TypeScript `strict`, no implicit `any`, IPC contracts typed end-to-end from `src/shared`. | `tsc --noEmit` in CI |

## 6. Traceability with the original document

| Item in `general.md` | Requirement(s) |
|---|---|
| Upload and reading of comics | RF-01, RF-02, RF-06, RF-30 |
| Organize into folders (product decision: outside the app) | RF-01 to RF-06, RF-64, `docs/10-decisoes.md` |
| Zoom option | RF-34, RF-33 |
| Change page via arrows and mouse | RF-35, RF-36 |
| Fullscreen | RF-37 |
| Zoomed portrait | RF-33 |
| Turn off the light | RF-38 |
| Save page on exit | RF-40 |
| CBR, CBZ, and ZIP with multiple files | RF-01, RF-02 |
| Comic deletion | RF-17 |
| "Continue where you left off" | RF-11, RF-42, RF-63 |
| List of all comics | RF-10 |
| Modern, clean, intuitive design | [07-ui-ux.md](07-ui-ux.md), RF-62 |
| Responsiveness | RNF-08 |
| Sidebar on the left | RF-60 |
| Dark theme, no light mode | [07-ui-ux.md](07-ui-ux.md) |
| Electron (Vite/TypeScript) | [02-arquitetura.md](02-arquitetura.md) |
| Not a social network / no login | Section 2 (out of scope), RNF-07 |

**Additions combined during refinement:** PDF (RF-01/RF-02), double page (RF-32), search/filters (RF-12, RF-13), read status (RF-14), favorites (RF-15), duplicates (RF-05), automatic and manual scan (RF-04), rename comic (RF-16), end of comic/next file in folder (RF-42).

**Post-v1 review (see `docs/10-decisoes.md`):** the manual import model (original RF-01–06) and the manual Lists/Sagas collections (former §4.3, RF-20–26) were replaced with scanning of user-configured root folders — with no file copying and no organization within the app. Later, the Library regained a folder view (RF-64, ADR-018): the user's own folder structure became navigable within the app (read-only), alongside the single list (RF-10..13).
