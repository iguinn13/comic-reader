# 08 — Implementation plan

Milestones are **vertical and incremental**: each one ends with the app running and something usable. The order minimizes rework: data and contracts before screens, and the reader before collections (it's the core of the value).

**Definition of done (applies to every task)**
- The code follows [02](02-arquitetura.md) and the contracts in [03](03-modelo-de-dados.md)/[04](04-contratos-ipc.md). If anything changed, the doc was updated in the same commit.
- `npm run typecheck`, `npm run lint`, and `npm test` pass.
- The acceptance criteria of the covered RFs were manually verified with `npm run dev`.
- New UI text is in `pt-BR.json`.

---

## M0 — Project foundation
**Goal:** a running skeleton with the dark window and the quality pipeline.

| # | Task | Done when |
|---|---|---|
| 0.1 | Create the project with the `electron-vite` React + TS template, clean up the boilerplate, and adjust `package.json` (name `comic-reader`, productName `Comic Reader`) | `npm run dev` opens the window |
| 0.2 | TS `strict` across the 3 tsconfigs, with `@shared`, `@main`, `@renderer` aliases | `npm run typecheck` ok |
| 0.3 | ESLint (flat config, typescript-eslint, react-hooks) + Prettier + `lint`/`format` scripts | clean lint |
| 0.4 | Tailwind v4 + tokens from [07 §2](07-ui-ux.md#2-design-tokens) + local Inter font + shadcn/ui initialized | Test page with themed button/inputs |
| 0.5 | Window security ([02 §6](02-arquitetura.md#6-security)): webPreferences, CSP, navigation lockdown, single instance, `backgroundColor` and `show` on `ready-to-show` | Checklist checked off |
| 0.6 | Vitest configured (`main` project, node environment) + 1 sample test | `npm test` ok |
| 0.7 | electron-builder (NSIS x64 on Windows; dmg/zip on macOS; AppImage/deb on Linux — ADR-021) with a placeholder icon and `npm run dist:win`/`dist:mac`/`dist:linux` scripts | Installer generated and the installed app opens |
| 0.8 | electron-log configured and `paths.ts` with every directory from [03 §3](03-modelo-de-dados.md#3-disk-layout) | Log written to `userData/logs` |

## M1 — Data and contracts
**Goal:** database, repositories, and the typed IPC bridge working end to end.

| # | Task | RFs |
|---|---|---|
| 1.1 | better-sqlite3 + Drizzle, full `schema.ts` ([03](03-modelo-de-dados.md)), first migration, pragmas, and boot-time migration (including in a packaged build) | — |
| 1.2 | `src/shared`: `types.ts`, `errors.ts` (`Result`, `AppError`), `channels.ts`, `schemas.ts`, `api.ts` (full interface, even before the handlers exist) | — |
| 1.3 | Main `handle()` helper + preload exposing `window.api` + `lib/api.ts` wrapper + TanStack Query provider | — |
| 1.4 | Repositories: comics, progress, library_folders, and settings, with Vitest tests using in-memory SQLite | — |
| 1.5 | `SettingsService` + `settings:*` IPC + window bounds restoration | RF-61 |
| 1.6 | `scripts/seed-dev.ts` script (N fake comics with generated covers) | RNF-02 |

## M2 — Folder-based library (scan)
**Goal:** get real comics into the app, reading directly from the user's folders, without copying ([05](05-importacao.md)).

> **Post-v1 revision** (see [ADR in 10-decisoes.md](10-decisoes.md)): this milestone originally implemented an *import* pipeline (file dialog/drag & drop, copy into `library/`, queue with interactive duplicate resolution). That model was replaced by scanning user-configured root folders, in place. The tasks below already reflect the current model.

| # | Task | RFs |
|---|---|---|
| 2.1 | Create test fixtures ([09 §3](09-testes-e-qualidade.md#3-fixtures)) | — |
| 2.2 | `archive/`: `detect.ts` (magic bytes), `ZipArchive` (yauzl), `RarArchive` (node-unrar-js), and `natural-sort`/page filter, with tests | RF-06 |
| 2.3 | PDF: `pdf-lib` (page count). ⚠️ **The hidden `pdf-worker`/cover render window hasn't been built yet** — see ADR-013 | RF-06 |
| 2.4 | `CoverService` for comic covers (nativeImage) — complete for zip/rar; PDF gets a placeholder cover (`TODO(M2-follow-up)` in `cover-service.ts`, see ADR-013) | RF-06 |
| 2.5 | `library_folders`: repository and `libraryFolders:*` IPC (folder dialog, list, remove) | RF-01, RF-03 |
| 2.6 | `walk-directory.ts` (recursive traversal) + `LibraryScanService` (detect, validate, hash, dedup, cover, insert, clean up missing files), with tests for the cases in [05 §10](05-importacao.md#10-required-test-cases) | RF-02, RF-04, RF-05, RF-06 |
| 2.7 | `library:scan` IPC + `library:scanProgress`/`library:changed` events; automatic scan on boot | RF-04 |
| 2.8 | UI: "Library folders" section in Settings (add/remove), "Refresh library" button in the sidebar | RF-01, 03, 04 |
| 2.9 | `MaintenanceService`: cleanup of orphaned covers on boot | RNF-05 |

**Pending item carried from M2 to M4** (recorded in [ADR-013](10-decisoes.md#adr-013)): the PDF cover (rendering page 1 in a hidden `BrowserWindow` with pdf.js, ADR-008) doesn't exist yet — PDF comics are indexed normally, just with a placeholder cover until this is picked back up, ideally alongside M4.9 (PDF support in the reader), when pdf.js is already being integrated anyway.

## M3 — Shell and library
**Goal:** browse and find the imported comics.

| # | Task | RFs |
|---|---|---|
| 3.1 | `AppShell` + `Sidebar` (expand/collapse, `Ctrl+B`, auto-collapse) + routes + i18n | RF-60 |
| 3.2 | `comic://` protocol (covers first) | — |
| 3.3 | `LibraryService.list` (normalized search, filters, sort, pagination) + IPC | RF-10, 12, 13 |
| 3.4 | `ComicCard` + virtualized grid + toolbar with persisted search, status, favorites, and sort | RF-10, 12, 13 |
| 3.5 | Favorite, rename, mark read/unread, delete (with confirmation) + context menu | RF-14..17, 19 |
| 3.6 | Multi-select + action bar | RF-18 |
| 3.7 | Favorites screen (reuses the grid) | RF-15 |
| 3.8 | Empty states | RF-62 |

## M4 — Reader (core)
**Goal:** read comfortably and never lose the page ([06](06-leitor.md)).

| # | Task | RFs |
|---|---|---|
| 4.1 | `PageCacheService` (ensure, prioritized extraction, dimensions, LRU) + `comic://page` and `comic://file` (with Range) | RF-43, RF-51 |
| 4.2 | `ReaderService`: `open` (session, merged prefs, next file in folder), `setPage` with debounce and flush (`close`, `before-quit`, `render-process-gone`), `savePrefs`/`resetPrefs`, `complete` | RF-30, 40, 41, 42 |
| 4.3 | Reader route, `reader-store`, top/bottom bars, slider, and "Go to page" | RF-30, 39 |
| 4.4 | **Single page** mode with fit, anchored zoom, pan, and preloading | RF-31, 34, 43 |
| 4.5 | Keyboard navigation (full table) and mouse (zones, wheel with cooldown, side buttons) | RF-35, 36 |
| 4.6 | Fullscreen (IPC + event) with auto-hiding of bars and cursor | RF-37, 38 |
| 4.7 | Virtualized **vertical** mode with adjustable width and current-page calculation | RF-33 |
| 4.8 | **Double page** mode (`computeSpreads` with tests, offset) | RF-32 |
| 4.9 | **PDF** support in all 3 modes (pdf.js canvas, discarding outside the window) | RF-01 |
| 4.10 | Automatic completion + end panel (suggesting the next file in the folder, RF-42) + comic error state | RF-42, 62 |
| 4.11 | **Home** screen with "Continue reading" and "Recently added" | RF-11, 63 |

## M5 — (removed in the post-v1 revision)

This milestone implemented Lists and Sagas (manual collections: create/edit/delete, add/remove comics, reorder a saga, collection cover, badge, and "Next in saga" in the reader). The entire feature was removed in favor of letting users organize via their own folders — see [ADR in 10-decisoes.md](10-decisoes.md) and RF-01 through RF-06. Nothing from this milestone remains in the code; "next file in folder" (the functional replacement for "Next in saga") is in M4.10.

## M6 — Settings and polish
| # | Task | RFs |
|---|---|---|
| 6.1 | Settings screen: reading defaults, "Apply to all", cache (usage, limit, clear), library (size, open folder), shortcuts, about | RF-50..53 |
| 6.2 | Toasts with Undo (remove from collection, mark as read) | — |
| 6.3 | `?` shortcuts panel in the reader | RF-35 |
| 6.4 | Accessibility review (focus, labels, contrast, keyboard in grids) | RNF-10 |
| 6.5 | Integrated title bar (`titleBarOverlay`) and final app icon, validated on all three OSes (ADR-021) | — |
| 6.6 | Review of all pt-BR text and empty states | RNF-09, RF-62 |

## M7 — Performance, robustness, and E2E tests
| # | Task | RNFs |
|---|---|---|
| 7.1 | Seed with 5,000 comics to measure boot time, grid scrolling, and search, and optimize whatever fails | RNF-02, 04 |
| 7.2 | 300-page comic in vertical mode to measure memory and tune the virtualization window | RNF-03 |
| 7.3 | Measuring page changes and first open (timing logs in dev) | RNF-01 |
| 7.4 | Playwright-Electron: E2E smoke test ([09 §2.3](09-testes-e-qualidade.md#23-e2e-playwright--electron)) | — |
| 7.5 | Robustness tests: killing the app mid-read and during a folder scan, and verifying consistency on reopening | RNF-05, 12 |

## M8 — Release v1.0
| # | Task |
|---|---|
| 8.1 | Final per-OS build via CI: NSIS on Windows (per-user install, Start Menu/Desktop shortcut, uninstaller that **asks** whether to remove user data); dmg/zip on macOS; AppImage/deb on Linux (ADR-021) |
| 8.2 | Installer test on a clean machine/VM per OS (Windows 10/11, macOS, Ubuntu/Debian) |
| 8.3 | Project README (how to run, build, and where the data lives) |
| 8.4 | `v1.0.0` tag + CHANGELOG |

---

## Requirement coverage

| RF | Milestone | RF | Milestone |
|---|---|---|---|
| RF-01 | M2 | RF-30 | M4 |
| RF-02 | M2 | RF-31 | M4 |
| RF-03 | M2 | RF-32 | M4 |
| RF-04 | M2 | RF-33 | M4 |
| RF-05 | M2 | RF-34 | M4 |
| RF-06 | M2 | RF-35 | M4, M6 |
| RF-10 | M3 | RF-36 | M4 |
| RF-11 | M4 | RF-37 | M4 |
| RF-12 | M3 | RF-38 | M4 |
| RF-13 | M3 | RF-39 | M4 |
| RF-14 | M3 | RF-40 | M4 |
| RF-15 | M3 | RF-41 | M4 |
| RF-16 | M3 | RF-42 | M4 |
| RF-17 | M3 | RF-43 | M4 |
| RF-18 | M3 | RF-44 | M4 |
| RF-19 | M3 | RF-50..53 | M6 |
| | | RF-60 | M3 |
| | | RF-61 | M1 |
| | | RF-62 | M3, M4, M6 |
| | | RF-63 | M4 |
| | | RF-64 | M3 (post-v1, see `docs/10-decisoes.md` ADR-018) |
