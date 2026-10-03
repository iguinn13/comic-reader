# 10 — Decision log (ADR)

Format: **Context → Decision → Consequences**. The possible statuses are *Accepted*, *Superseded by ADR-xxx*, or *Rejected*. To reverse a decision, create a new ADR; don't edit the old one.

---

### ADR-001 — Electron + electron-vite + React + TypeScript
**Status:** Accepted · **Date:** 2026-09-23

**Context.** The user had already settled on Electron with Vite/TypeScript. What remained was choosing the UI layer and the build tool.
**Decision.** Use **electron-vite**, which integrates the main, preload, and renderer build with HMR, with **React** and **Tailwind v4 + shadcn/ui** (Radix) for the UI.
**Consequences.** The broader ecosystem of accessible components (context menus, dialogs, sliders) speeds up building screens. shadcn copies component code into the repo, which gives full control over the dark visuals. The choice requires discipline to avoid bloating the bundle.

### ADR-002 — SQLite (better-sqlite3) + Drizzle ORM
**Status:** Accepted · **Date:** 2026-09-23

**Context.** Queries with filtering, sorting, and joins (collections, progress) are needed over thousands of comics, with referential integrity.
**Decision.** Use **SQLite** via **better-sqlite3** (synchronous and fast in main) with **Drizzle** (types + generated migrations).
**Alternatives.** JSON on disk (no queries, no integrity, risk of corruption). `node:sqlite` (API still unstable across the Node versions bundled with Electron). IndexedDB in the renderer (couples the data to the UI and makes access from main harder).
**Consequences.** The module is native: electron-builder rebuilds it during packaging, and tests need their own strategy ([09 §1](09-testes-e-qualidade.md#1-pyramid)). Synchronous calls are acceptable because the queries are small, but any query > 16 ms should be investigated.

### ADR-003 — Copy imported files into a managed library
**Status:** Superseded by [ADR-017](#adr-017--reference-files-in-place-instead-of-copying-into-a-managed-library-removal-of-listssagas) · **Date:** 2026-09-23

**Context.** Referencing the original file breaks the comic if the user moves or deletes the original.
**Decision.** **Copy** into `userData/library/{id}.{ext}` (the user's choice).
**Consequences.** Reading becomes robust and independent of the original. The cost is duplicated disk space while the user keeps the originals around. The library size shows up in Settings (RF-52). A v2 could offer "move" instead of copy, or a configurable library folder.

### ADR-004 — Serve pages via a custom `comic://` protocol
**Status:** Accepted · **Date:** 2026-09-23

**Context.** Sending images over IPC (base64/Buffer) costs CPU and memory and prevents caching and Chromium's asynchronous decoding. Exposing `file://` would require disabling protections and would leak paths to the renderer.
**Decision.** Use the `comic://` protocol with `protocol.handle`, resolving **IDs** to paths in main.
**Consequences.** Native `<img>` and `fetch`, with HTTP caching and asynchronous `decode()`. The renderer never knows paths. The cover URL needs versioning (`?v=`) to invalidate the cache.

### ADR-005 — On-demand extraction to an LRU disk cache
**Status:** Accepted · **Date:** 2026-09-23

**Context.** RAR doesn't allow efficient random access (solid archives). Extracting everything at import time would double the disk usage of the entire library.
**Decision.** At import time, only **list** the pages. When the comic is **opened**, extract in the background to `cache/pages/{id}`, starting from the current page, with a size limit (LRU, default 2 GB). ZIP also serves pages directly from the archive while extraction hasn't caught up yet.
**Consequences.** Import is fast and disk usage is controlled. The first time a large CBR is opened, pages far from the current one may take longer. The cache is disposable.

### ADR-006 — `node-unrar-js` (WASM) for CBR
**Status:** Accepted · **Date:** 2026-09-23

**Context.** CBR is RAR, which is proprietary. The options were a bundled `unrar`/`7z` binary (licensing, antivirus, per-platform packaging) or WASM.
**Decision.** Use **node-unrar-js** (unrar compiled to WASM), supporting RAR4 and RAR5.
**Consequences.** No external binaries or platform dependency. Needs the whole file in memory (practical limit recorded in [05 §9](05-importacao.md#9-limits-and-performance)). Doesn't create RAR archives, which isn't needed anyway.

### ADR-007 — PDF: `pdf-lib` in main for metadata, `pdf.js` for rendering
**Status:** Accepted · **Date:** 2026-09-23

**Context.** pdf.js in Node needs native `canvas`. The renderer already has canvas.
**Decision.** In main, use **pdf-lib** (pure JS) only to count pages and validate the file. Rendering is done by **pdf.js** in the renderer (reading) and in the hidden worker window (cover, ADR-008).
**Consequences.** No extra native dependencies. PDF pages are canvases, not `<img>`, so the reader needs a dedicated page component.

### ADR-008 — Hidden window to generate PDF covers
**Status:** Accepted · **Date:** 2026-09-23

**Context.** The PDF cover must be generated during import, which runs in main, even with no specific screen open.
**Decision.** Create a **hidden** `BrowserWindow` (sandboxed, no preload beyond what's needed, `show: false`) that loads pdf.js and exposes "render page 1 of this comicId at N px → JPEG" via dedicated IPC. It's created on demand and destroyed after 60 s of idleness.
**Consequences.** Import stays self-contained and testable (the worker can be swapped for a fake). The cost is an extra renderer process during PDF imports.

### ADR-009 — Thumbnails with `nativeImage` instead of `sharp`
**Status:** Accepted · **Date:** 2026-09-23

**Context.** `sharp` is excellent, but it's one more large native module to package.
**Decision.** Use `nativeImage.createFromBuffer(...).resize({ width, quality: 'good' }).toJPEG(q)`.
**Consequences.** Zero extra dependencies. `nativeImage` doesn't decode AVIF and some animated WebP: in those cases the cover falls back to a placeholder (logged), and reading still works normally because Chromium decodes them. If this becomes a problem, a future ADR could adopt `sharp`.

### ADR-010 — Debounce progress in main
**Status:** Accepted · **Date:** 2026-09-23

**Context.** RF-40 requires never losing the page. A debounce in the renderer loses the last value if the renderer dies.
**Decision.** The renderer sends **every** page change (cheap IPC). Main keeps the last value in memory and writes it with a 500 ms debounce, with a synchronous `flush` on `reader:close`, `before-quit`, and `render-process-gone`.
**Consequences.** In the worst case (power outage), at most 500 ms of progress is lost (RNF-12). IPC becomes slightly more verbose, which is irrelevant.

### ADR-011 — TanStack Query + Zustand in the renderer
**Status:** Accepted · **Date:** 2026-09-23

**Context.** The renderer consumes data from main (which is the source of truth) and has local UI state (reader, selection, sidebar).
**Decision.** Use **TanStack Query** for data coming from IPC (caching, invalidation, optimism) and **Zustand** only for UI state.
**Consequences.** No database data is duplicated in stores. Invalidation is centralized in `query-keys.ts` and also triggered by events from main (`library:changed`).

### ADR-012 — Windows only in v1, cross-platform code
**Status:** Superseded by [ADR-021](#adr-021--multiplatform-windowsmacoslinux-and-open-source-preparation) · **Date:** 2026-09-23

**Context.** The user asked for packaging for Windows only.
**Decision.** Distribute **NSIS x64** in v1, but avoid Windows-exclusive APIs without an abstraction, and always build paths with `path`/`paths.ts`.
**Consequences.** Linux and macOS remain viable in v2, with targets in `electron-builder.yml`. `titleBarOverlay` behaves differently on macOS and should be revisited in v2.

### ADR-013 — PDF cover deferred until after M2 (no `pdf-worker`)
**Status:** Accepted · **Date:** 2026-09-23

**Context.** ADR-008 called for a hidden `BrowserWindow` with pdf.js to render the cover for PDFs during import (M2, tasks 2.3/2.4). Building and validating that window requires a real running Electron — something the environment where M2 was implemented couldn't do (the Electron binary isn't available in that sandbox; see the environment note in the session history). Implementing this piece without ever running it even once would mean building blind.
**Decision.** M2 delivers **complete** PDF import (RF-01: validates, counts pages with `pdf-lib`, imports) but with a **placeholder cover** (`cover_version = 0`) — a path the spec itself already anticipated (docs/05-importacao.md §4, step 7: a cover generation failure never fails the item). The extension point is marked with a `TODO(M2-follow-up)` comment in `src/main/services/cover-service.ts`, pointing exactly to where the `pdf-worker` call would go.
**Consequences.** Every PDF comic in the library shows the cover placeholder until this is picked back up — ideally alongside **M4.9** (PDF support in the reader), when pdf.js will already be integrated into the renderer anyway, reducing duplicated work. No signature change is expected in `CoverService.generateComicCover` beyond now receiving a non-null `firstPageBuffer` for PDFs.

> **Update (M4.9):** the PDF reader (ADR-007) has been implemented — see ADR-014. The hidden cover-worker window (ADR-008) is still pending; this ADR-013 remains in effect only for that part.

### ADR-014 — pdf.js in the reader: version pinned to 4.x, `comic://` with CORS, relaxed CSP in dev
**Status:** Accepted · **Date:** 2026-09-24

**Context.** M4.9 implemented `PdfPage` (canvas) and `usePdfDocument` (`src/renderer/src/features/reader/`) using `pdfjs-dist`, per ADR-007. Three problems only surfaced when running the real app (real Electron, not just the tests):
1. `pdfjs-dist` 6.x internally uses `Map.prototype.getOrInsertComputed` (a recent TC39 proposal) that doesn't exist yet in the V8 bundled with Electron 39 — the worker crashes with a `TypeError` when loading any PDF.
2. `pdf.js` only uses `fetch` for a `url` with an `http(s):` scheme (`isValidFetchUrl`); for `comic:` it would fall back to streaming via `XMLHttpRequest`, which Chromium refuses for non-standard schemes ("Cross origin requests are only supported for protocol schemes...").
3. `@vitejs/plugin-react` injects an inline `<script>` (the Fast Refresh preamble) into the HTML served in dev, which the CSP (`script-src 'self'`) blocks — the entire page breaks with "can't detect preamble", even with no PDF involved.

**Decision.**
1. Pin `pdfjs-dist` to `^4.10.38` (the 4.x line), not the latest major (6.x).
2. `usePdfDocument` fetches the bytes with `fetch(comicFileUrl)` and calls `getDocument({ data })`, never `getDocument({ url })` — this avoids pdf.js's internal network path. The `comic:` protocol gained the `corsEnabled: true` privilege (`src/main/protocol.ts`) so this `fetch` works from the renderer.
3. In dev (`is.dev`), the CSP now includes `'unsafe-inline'` in `script-src`, in addition to the already-existing `'unsafe-eval'`. This only applies in dev — the Fast Refresh preamble doesn't exist in the production build.

**Consequences.** Upgrading `pdfjs-dist` to 5.x/6.x in the future requires re-checking compatibility with whatever V8 version Electron bundles at the time (item 1) before simply bumping the version. `'unsafe-inline'` in `script-src` only in dev is a real CSP relaxation, but has no effect in production — the security checklist in [02 §6](02-arquitetura.md#6-security) still applies to the packaged build.

### ADR-015 — "Add to…" as a dialog, not a submenu
**Status:** Superseded by [ADR-017](#adr-017--reference-files-in-place-instead-of-copying-into-a-managed-library-removal-of-listssagas) (Lists/Sagas removed — there's no more "Add to…") · **Date:** 2026-09-25

**Context.** RF-19/RF-23/RF-44 described "Add to…" as a submenu with lists, sagas, and "New list…/New saga…", in three places (card, multi-select, reader). The project's menu wrappers (`context-menu`, `dropdown-menu`) have no submenus, and the same flow needs to work across all three menus (context and dropdown).
**Decision.** A single `AddToCollectionDialog` (`features/collections/`), opened via an "Add to…" item in each menu. Lists the collections with a checkmark (all comics already in it) or a dash (only some), toggles on click, and creates a new collection already containing the comics.
**Consequences.** One extra click compared to a submenu, in exchange for a single component with inline creation that's easy to extend with search. If a submenu is preferred later, it's just a matter of swapping the entry point.

### ADR-016 — Uninstaller asks before deleting data
**Context.** electron-builder's `deleteAppDataOnUninstall` deletes everything without asking; reinstalling/updating must not destroy the library.
**Decision.** `deleteAppDataOnUninstall: false` and a `customUnInstall` macro in `build/installer.nsh` with a `MessageBox` (default: keep). Silent mode never deletes.
**Consequence.** Testing the installer on clean Windows 10/11 installs (M8.2) must be done manually.

### ADR-017 — Reference files in place instead of copying into a managed library; removal of Lists/Sagas
**Status:** Accepted · **Date:** 2026-09-25

**Context.** After using v1, the user requested two mutually-implying product changes: (1) completely remove Lists and Sagas (manual organization into collections, ADR-015, original RF-20–26); (2) the app should no longer have a per-comic "import" flow — the user simply points to one or more folders where comics are already organized, scanned recursively ("may be chained"), in the style of the Windows "Cover" app. This is incompatible with ADR-003 (copying into `userData/library/`): if the app kept copying, the pointed-to folder would stop reflecting the same structure the user already maintains, and the app would go back to "owning" a separately organized copy — exactly the model that was meant to be abandoned.

**Decision.**
1. **No copying.** `comics.file_path` now points to the original file, wherever it is; the app only reads, never copies/moves. `userData/library/` no longer exists.
2. **Configurable, multiple root folders.** New `library_folders` table (docs/03 §2.1): the user adds/removes root folders from the Settings screen; each one is scanned recursively by `LibraryScanService` (docs/05).
3. **Scan instead of import.** No interactive queue, no duplicate dialog: the scan runs on its own (automatic on boot + manual "Refresh library" button), resolves duplicates by hash silently (keeps the first occurrence), and removes from the index any comic whose file disappeared — all without blocking the user with questions, because there's no longer a person watching the result item by item like before.
4. **Lists and Sagas removed entirely.** `collections`/`collection_items` tables, `CollectionService`, the Sagas/Lists screens, "Add to…" (ADR-015) — all removed. Organization is entirely the user's own folder structure; the library UI is a single list/grid (search, sort, filters), with no hierarchy.
5. **Functional replacement for "Next in saga":** the end-of-reading panel (RF-42) now suggests the next file (natural order, `naturalSort()`) from the **same folder** — automatic, with no user configuration.
6. **Deleting a comic becomes a two-level opt-in** (RF-17): by default it only removes it from the index (the user organizes the files, so the app shouldn't delete them without asking); an explicit "Also delete the file from disk" checkbox performs the actual deletion, and even then only if the file is still inside a configured root folder (a safety check in `LibraryService.delete`).
7. **Consolidated migration.** Since v1 hadn't shipped yet (no user database in production), migration `0000` was rewritten to reflect the final schema directly, instead of stacking an incremental `0001` migration just for this pre-release architectural shift (docs/03 §4).

**Consequences.**
- **Robustness traded for ease of use:** if the user moves/renames a file outside the app, the comic disappears from the index until the next scan finds it again — as a "new" entry (new id, progress reset), because there's no way to be certain it's "the same" comic without risking reusing progress from the wrong one. This is a robustness regression compared to the copy model (ADR-003), but it's the accepted price of the product decision to never duplicate or touch the user's files.
- **No "import summary":** individual file errors (corrupted, no pages) are only logged, not shown in a summary UI — the scan is a background event, not an action the user is watching step by step.
- **Loss of manual organization:** anyone who used Lists/Sagas to group comics without touching the real folder structure loses that option; the equivalent path now is organizing via the OS's own Explorer/folders.
- **`FORMAT_TO_FILE_EXT`/`ComicFileFormat`** (which mapped format → internal library file extension) no longer made sense and were removed — the real extension now comes from `file_path`.

### ADR-018 — Folder navigation in the Library, with no intermediate folders table
**Status:** Accepted · **Date:** 2026-09-25

**Context.** ADR-017 replaced Lists/Sagas with a single flat list/grid Library, with no hierarchy — a decision that made sense alongside manual import, but actual use showed it was incomplete: the whole point of having "chained" root folders (RF-02) is precisely to let the user browse the organization they already maintain (e.g. `comics/DC/Year One/`), in the style of the Windows "Cover" app — a flat list hides that structure.
**Decision.**
1. The Library gains two views (RF-64), switched by a button: **Folders** (new, default) and **All comics** (the existing flat list, kept as is).
2. Click-based navigation ("Cover" style), not a fixed side tree: the grid shows the current level's subfolders as cards, alongside the comics that live directly there; clicking a subfolder enters it, with a breadcrumb at the top to go back. No dedicated side column — avoids duplicating the main sidebar and keeps the screen simple.
3. **No new "folders" table.** Only `library_folders` (root folders) and `comics.file_path`/`dir_path` (docs/03 §2.1/§2.2) exist — there's no row per intermediate subfolder in the database. The new `LibraryService.browseFolder` fetches every comic in a root folder and groups them in memory by the first segment of the path relative to the requested level: one segment = a comic directly at this level; more than one = it belongs to the subfolder named by the first segment. Simple to implement and correct by construction (the real structure is always whatever `file_path` says), at the cost of recomputing the grouping on every navigation instead of serving from a precomputed table — acceptable for the expected library sizes (thousands of comics, not millions).
4. The top level of navigation (before entering any root folder) lists the configured root folders as if they were subfolders, except for ones that have subfolders of their own: those disappear and their children (plus any loose comics in them) take their place — reusing the same response shape (`FolderContents`) instead of a special case in the UI.
**Consequences.** Every folder change is a new query (`library.browseFolder` IPC); no cache of "what are the subfolders of X" beyond what TanStack Query already keeps per `queryKey`. If a root folder accumulates tens of thousands of comics, grouping in memory on every click could become noticeable — not a problem for now, but a candidate for pagination/a dedicated index if real slowness gets reported (RNF-02).

### ADR-019 — Removal of focus mode (RF-38)
**Status:** Accepted · **Date:** 2026-09-25

**Context.** Focus mode ("turn off the lights") overlapped with fullscreen: the bars already auto-hide in fullscreen, and the reader background is already near-black.
**Decision.** Remove focus mode: the button, the `L` shortcut, the `reader.focusMode` setting, and the state in the store. Fullscreen (RF-37) keeps auto-hiding the bars.
**Consequences.** Old `reader.focusMode` values that may exist in the database become orphaned and are ignored.

### ADR-020 — Custom cover for folders with no comics
**Status:** Accepted · **Date:** 2026-09-25

**Context.** Folders with no comics directly in them (only subfolders) show a generic icon in folder navigation (RF-64), and there's no intermediate folders table (ADR-018).
**Decision.** The user can choose an image for these folders (card context menu). The image is downscaled to 400 px (JPEG q=82) and saved to `covers/folders/{key}.jpg`, with `key = sha1(folderId + ":" + relativePath)`. The file's existence is the only state — no new table, no migration — and it's served via `comic://cover/folder/{key}`. If the folder later gets direct comics, the first comic's cover takes precedence.
**Consequences.** Renaming/moving the folder on disk changes the `relativePath` and therefore the key: the chosen cover stops being found (the orphaned file stays in `covers/folders/`, with no automatic cleanup for now).

### ADR-021 — Multiplatform (Windows/macOS/Linux) and open-source preparation
**Status:** Accepted · **Date:** 2026-10-03

**Context.** ADR-012 limited v1 to Windows at the user's request, but already noted that the code avoided platform-exclusive APIs and that mac/linux support would be "just configuration" in a v2. The project is now going to be released as open source, which makes the three major desktop platforms a direct requirement rather than a v2 "nice to have." An audit of `src/` confirmed ADR-012's premise: there's no `child_process`/external binary; every path uses `path.join`/`app.getPath`; CBR uses `node-unrar-js` (WASM); ZIP uses `yauzl`/`yazl`; PDF uses `pdf-lib`/`pdfjs-dist`; thumbnails use Electron's own `nativeImage` — all pure JS or WASM, with no OS-specific native binary, except `better-sqlite3`, which is already rebuilt per platform by `electron-builder install-app-deps` (`postinstall`). Only two occurrences of `process.platform` exist in the project: one in `src/main/index.ts` (disables GPU acceleration on Linux, a dev workaround for WSL, with no effect on production) and one in `src/main/window.ts` (manually sets the `icon` on Linux). No architectural change was needed — only packaging configuration, small OS-convention adjustments, and documentation.

**Decision.**
1. **Build targets:** Windows via NSIS x64 (kept as is); macOS via `dmg` + `zip`, for `x64` and `arm64` architectures (separate builds, not `universal`); Linux via `AppImage` + `deb`, x64. A single icon (`build/icon.png`, ≥512×512) across every block — `electron-builder` converts it to `.icns`/the appropriate size set automatically during the build, with no need to manually generate/commit those artifacts.
2. **Code signing:** not implemented at this stage. Windows and macOS builds are unsigned — users will see OS warnings (SmartScreen on Windows, Gatekeeper on macOS) the first time they open the app. This is an accepted and documented decision in the README; revisable in the future if the project grows (signing has a recurring monetary cost, incompatible with an open-source project with no defined budget).
3. **Removing data on uninstall:** the behavior of asking before deleting user data (ADR-016, `build/installer.nsh`) is exclusive to the NSIS/Windows installer — there's no equivalent hook for `.dmg` (macOS has no uninstaller, it's "drag to trash") nor for `.AppImage`/`.deb` (Linux). This asymmetry is accepted; the README documents how to remove the data manually on each OS.
4. **Title bar (`titleBarStyle`/`titleBarOverlay`):** kept the same across all 3 OSes for now (not conditioned on `process.platform`) — it's an API officially supported by Electron on all three platforms. Per-OS fine-tuning (e.g. native `hiddenInset` on macOS) remains a possible follow-up, only if manual visual validation on macOS finds the default result lacking.
5. **`window-all-closed`/`activate`:** now follow each OS's convention — on macOS, the app stays alive (dock) after closing the last window, and `activate` reopens it; on Windows/Linux, the app quits (unchanged behavior).
6. **CI:** GitHub Actions (`.github/workflows/build.yml`) with a Windows/macOS/Linux matrix builds and tests (typecheck, lint, test, build) on every push/PR; per-OS installer builds are available as artifacts, published to a Release when a tag/release is created.
7. **License:** the project is published as open source under MIT (`LICENSE`, repository root).
8. **In-progress translation/OCR feature (RF-70):** uncommitted work on this front was stashed (`git stash`) and deferred to a future decision — including the still-open question of how to version the ~121 MB of ONNX/Tesseract models (on-demand download vs. Git LFS) without compromising the leanness of the open-source repository.

**Consequences.** The product is now distributed for the three major desktop platforms, aligned with the open-source release. The lack of code signing is a visible limitation for end users (OS warnings), consciously accepted. The title bar and window lifecycle behavior on macOS/Linux depend on manual visual validation (there's no CI runner with a real display for that) — recorded as a post-merge pending item. The symmetry of "asking before deleting data on uninstall" doesn't exist outside Windows; macOS/Linux users need to remove the data manually, as documented in the README.

### ADR-022 — Bilingual UI (pt-BR default + en-US), selector in Settings
**Status:** Accepted · **Date:** 2026-10-03

**Context.** With the project going open source (ADR-021), the audience of users and contributors is no longer exclusively Portuguese-speaking. The UI was fixed to pt-BR (original RNF-09), but the i18next infrastructure already anticipated this: a single `translation` namespace, nesting by domain, `_one`/`_other` plural suffixes, and `{{var}}` interpolation — all compatible with adding a second language without touching the components, just registering a new resource.

**Decision.**
1. New `src/renderer/src/i18n/locales/en-US.json` locale, with exactly the same keys as `pt-BR.json`.
2. New settings key `ui.language: 'pt-BR' | 'en-US'`, defaulting to `'pt-BR'` (preserves current behavior for existing app users), following the same generic pattern as `ui.sidebarCollapsed` (`src/shared/types.ts`, `constants.ts`, `schemas.ts` — no IPC change needed, since `settings:update` already operates on `Partial<Settings>`).
3. `src/renderer/src/i18n/index.ts` registers both `resources`; `AppShell` syncs `i18n.changeLanguage(...)` from the persisted settings, switching the language at runtime without restarting the app.
4. A selector on the Settings screen reusing the `Segmented` component (already used for `reader.mode`/`reader.fit`), with each language's label shown in its own language ("Português"/"English").
5. `formatBytes` (`src/renderer/src/lib/format.ts`) now formats numbers with `Intl` in the active language (`i18n.language`), instead of a fixed `'pt-BR'`.
6. A parity test (`src/renderer/src/i18n/locales.test.ts`) recursively compares the keys of both locale files and fails if either is missing a key — prevents the locales from drifting apart over time.

**Consequences.** `pt-BR` remains the default language and i18next's fallback; no existing user is affected without explicit action. Every new UI string needs to be added to both locale files (the parity test turns this into a CI error instead of a silent problem). RNF-09 in `docs/01-requisitos.md` was rewritten to reflect bilingual support.
