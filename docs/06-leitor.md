# 06 — Reader

Covers RF-30 through RF-44. The reader is the app's most important screen and must be fast, quiet, and predictable.

## 1. Route and lifecycle

- Route: `#/read/:comicId`.
- The reader occupies the entire area: the sidebar is **hidden** in the reader, which has its own "Back" button.
- **Entry:** `reader.open(comicId)` → `ReaderSession`. While loading, the screen shows a blurred cover + spinner.
- **Exit** (Back button, `Esc` with nothing else active, or `Backspace`): `reader.close(comicId)` and returns to the previous route (`navigate(-1)`, or `/library` if there's no history).
- **Errors:** `FILE_MISSING` and `CORRUPTED_FILE` show an error state with "Back" and "Remove from library" (RF-62). An individual page that fails to load shows a "Couldn't load page N" placeholder, and navigation continues.

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ←  Batman: Year One #1                               ▣ ▥ ≡  − 100% +  ♡ ⋯  ☾  ⛶ │  ← top bar
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ‹                        [ PAGE ]                             ›    │  ← reading area
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━●──────────────────────────   12 / 48   [Go…]    │  ← bottom bar
└──────────────────────────────────────────────────────────────────────┘
```

- **Top bar:** back; title (clickable → rename); mode selector (`single` / `double` / `vertical`); fit/zoom controls (depend on mode); favorite (RF-44); `⋯` menu (Mark as unread, Restore reading defaults); fullscreen (⛶).
- **Bottom bar:** page slider (dragging shows the "page N" preview), `N / total` indicator (clickable → "Go to page" field), and navigation arrows.
- **Reading area:** `--reader-bg` background (near-black).
- **Auto-hide:** in **fullscreen**, the bars disappear after 1.5 s of no mouse movement and reappear when the mouse moves or approaches the edges. The opacity/position transition of the bars is smooth (`150ms ease-out`, `transition-[opacity,transform]`), not an abrupt cut. The reading area's scrollbar also disappears along with them (`scrollbar-width: none` / `::-webkit-scrollbar`), and the cursor disappears when the bars are hidden. Outside of fullscreen, the bars are always visible.

## 3. Reading modes

### 3.1 Single page (`single`) — RF-31

Shows one centered page. The fit options are:
- **Height** (default): the whole page fits within the area's height.
- **Width**: the width fills the area and the vertical overflow is scrollable.
- **Original**: 100% of the image's pixels.

**Zoom** (RF-34) multiplies the resulting `fit` size (25%–400%, in steps of 10% up to 100% and 25% above that), with the "100%" indicator clickable to reset.
- When the page exceeds the area, it can be dragged (pan) with the mouse (`grab` cursor) and scrolled with the wheel/`↑`/`↓`.
- Zoom with `Ctrl+wheel` is anchored to the mouse pointer.
- When changing pages, the scroll position returns to the **top** of the new page. Zoom/fit is preserved.

### 3.2 Double page (`double`) — RF-32

Builds the **spreads** from the page list:
1. Page 0 (cover) is always alone.
2. A **wide** page (`width > height`, known via `comic_pages` or measured on load) is alone.
3. The remaining pages form pairs in order: `[1,2]`, `[3,4]`, …
4. With `doubleOffset = true`, the cover gets paired and the pairs shift by 1 (fixes comics with "broken" double pages).
5. A final unpaired page is alone.

Display is **left-to-right**, with the two pages side by side (no gap), scaled to the same height, and the whole spread respects `fit`/zoom as in single mode. Navigation advances by spread. The saved `current_page` = index of the **first** page of the spread.

If a page's dimensions aren't known yet, the layout assumes portrait and is **recalculated** when the image loads, preserving the currently visible page.

### 3.3 Continuous vertical (`vertical`) — RF-33 ("portrait with zoom")

- Pages are stacked in a centered column, with 0 px gap (webtoon style), continuous scroll.
- **Column width** = `verticalWidth × area width` (20%–100%, default 60%). This is this mode's "zoom": `+`/`-`, `Ctrl+wheel`, and the slider in the top bar change the width in 5% steps.
- **Virtualization** with `@tanstack/react-virtual`: only pages within ±2 viewports are mounted (RNF-03). Each item's estimated height comes from known `width/height` (or 1.5× the width), and it is measured and corrected on load.
- **Current page** = the page crossing the line at 1/3 of the viewport height. It's updated during scroll (150 ms throttle) and reported via `setPage`.
- When opening or switching to this mode, scrolling positions the top of the current page at the top of the viewport.
- Changing the width preserves the current page and the relative position within it.

### 3.4 PDF

Works in all three modes. The renderer loads `comic://file/{id}` with pdf.js (`pdfjs-dist`, locally bundled worker) and renders each page onto a `<canvas>` at `displayWidth × devicePixelRatio` resolution. Renders outside the preload window are discarded to free up memory. On the first render of each page, the renderer reports `reportPageSize` (used by the spread layout and placeholders).

## 4. Navigation — RF-35, RF-36

"Advance" = next page (single), next spread (double), or next page aligned to the top (vertical).

### 4.1 Mouse
| Action | single / double | vertical |
|---|---|---|
| Click on the left third of the area | Back | — (no zones; click doesn't navigate) |
| Click on the right third | Advance | — |
| Click in the center | Show/hide bars (in fullscreen) | Show/hide bars |
| Wheel ↓ / ↑ | If the page fits entirely: advance/back (1 change per gesture, with a 250 ms cooldown). If it overflows: scrolls; at the end/start, one more gesture changes the page. | Scrolls normally |
| `Ctrl` + wheel | Zoom | Column width |
| Mouse side buttons (4/5) | Back / Advance | Back / Advance page |
| Drag (with zoom) | Pan | — |
| Double click | Toggles between current `fit` and 200% zoom at the point | Toggles fullscreen |

Clicks in the zones don't trigger when the gesture was a drag (pan).

## 5. Keyboard shortcuts

Shortcuts are only active on the reader route and are ignored when focus is on an input.

| Key | Action |
|---|---|
| `→` / `PageDown` | Advance |
| `←` / `PageUp` | Back |
| `Space` | Scroll ~85% of the viewport down; if already at the end of the page (or the page fits), advances |
| `Shift+Space` | Reverse of Space |
| `↓` / `↑` | Scroll 15% of the viewport (when there's overflow) |
| `Home` / `End` | First / last page |
| `G` | Open "Go to page" |
| `1` / `2` / `3` | Single / double / vertical page mode |
| `W` | Toggle `fit` Height ↔ Width (single/double) |
| `+` / `=` and `-` | Zoom in/out (or width, in vertical) |
| `0` | Reset zoom (100%, or default width in vertical) |
| `O` | Toggle "Offset pairs" (double) |
| `F` / `F11` | Fullscreen |
| `S` | Favorite/unfavorite |
| `Esc` | In order: closes the open dialog/menu → exits fullscreen → exits the reader |
| `Backspace` | Exit the reader |
| `?` | Show shortcuts panel |

The shortcuts table also appears in a dialog (`?`) and in Settings.

## 6. Fullscreen — RF-37

`BrowserWindow.setFullScreen(true)` (via `app.toggleFullscreen`), with the window above the system's taskbar/dock. The reader enters fullscreen automatically when a comic is opened (with the bars already in idle mode, auto-hiding after 1.5 s) and exits it when leaving the reader. Focus mode (RF-38) was removed (see ADR in `10`).

The renderer listens to `onFullscreenChanged`, because the user may exit fullscreen through OS means.

Leaving the reader (back, `Esc`, or unmount for any other reason) while the window is in fullscreen also exits fullscreen — the window never gets stuck in fullscreen outside the reader, since the toggle is exclusive to this screen.

## 7. Preloading and cache — RF-43, RNF-01

**Main (`PageCacheService`)**
- `reader.open` calls `ensure(comicId, startPage)`: if `cache/pages/{id}/.complete` doesn't exist, it starts full extraction in the background, **starting from the current page** (order: current → end → start).
- `comic://page/{id}/{n}`: if the page file already exists in the cache, serves it directly. Otherwise, for ZIP it reads the entry directly from the file (random access) and writes it to the cache. For RAR, it waits for the ongoing extraction to reach the page (RAR extraction is sequential).
- During extraction, it measures the page with `image-size` and writes `width/height` to `comic_pages` (in batches).
- **LRU:** the access date of each `cache/pages/{id}` directory is recorded in memory and persisted in the marker's `mtime`. When the total exceeds `cache.maxBytes`, it removes the least recently used comics, never the one currently open.

**Renderer**
- single/double: preloads (`new Image().src = url` + `decode()`) the **3 next** and **1 previous** pages/spreads.
- vertical: virtualization mounts ±2 viewports, and images use `loading="eager"` within that window.
- All `<img>` elements use `decoding="async"` and `draggable={false}`.

## 8. Progress — RF-40, RF-41, RF-42

- On every page change, the renderer calls `reader.setPage(comicId, page)`. Debounce and flush live in main ([04 §4.4](04-contratos-ipc.md#44-reader)).
- `last_read_at` is updated on every write.
- **Preferences:** any change to mode, fit, zoom, width, or offset calls `reader.savePrefs` (500 ms debounce in the renderer). "Restore reading defaults" (`⋯` menu) calls `resetPrefs`.
- **Completion:** when the last page becomes visible (single: displayed; double: last spread displayed; vertical: the last page crosses the 1/3 line **or** scroll reaches the end), the renderer calls `reader.complete` once per session.
- **End panel:** "advancing" while at the end opens a centered overlay:

```
┌──────────────────────────────────────────────┐
│  ✓ You finished "Batman: Year One #1"        │
│                                              │
│  Next file in this folder:                   │
│  [cover]  Batman: Year One #2      [ Read → ] │
│                                              │
│  [ Back to library ]       [ Stay here ]     │
└──────────────────────────────────────────────┘
```

- The suggestion comes from `nextInFolder` (`ReaderSession`, docs/04 §2): the next file in natural order within the same folder (docs/05 §6) — purely positional, with no dependency on any manual organization.
- **Read →** calls `reader.open(nextId)` without leaving the route (`replace`).
- When there's no next file in the folder (last or only comic in the directory): only the bottom buttons appear.
- `→` in the panel activates the focused button (default: "Read →" if it exists); `Esc` closes it.

## 9. State (Zustand `reader-store`)

```ts
interface ReaderState {
  session: ReaderSession | null;
  currentPage: number;
  prefs: ReaderPrefs;
  spreads: number[][];          // derived (double)
  chromeVisible: boolean;       // bars visible
  isFullscreen: boolean;
  endPanelOpen: boolean;
  goTo(page: number): void;     // clamp + setPage IPC
  next(): void; prev(): void;
  setPrefs(p: Partial<ReaderPrefs>): void;
}
```

The mode components (`SingleView`, `DoubleView`, `VerticalView`, and `PdfPage` for PDF pages) only consume state. The navigation logic lives in testable hooks (`useReaderKeyboard`, `useWheelPaging`, `computeSpreads`).

## 10. Reader acceptance criteria (QA summary)

- [ ] Opening a comic in progress shows exactly the saved page, in the saved mode.
- [ ] Closing the app with `Alt+F4` mid-read and reopening returns to the same page.
- [ ] `←`/`→` work in all 3 modes. Clicking the zones works in single/double.
- [ ] A wide page appears alone in double mode. "Offset pairs" changes the pairing.
- [ ] In vertical mode, `+`/`-` changes the width and the visible page doesn't "jump".
- [ ] Fullscreen: bars disappear after 1.5 s and return with the mouse; the taskbar/dock also disappears.
- [ ] Reaching the last page marks it as read, and advancing shows the panel with the next file in the folder (when one exists).
- [ ] Leaving the reader in fullscreen returns the window to its normal state.
- [ ] A 300-page comic in vertical mode: memory usage within RNF-03.
- [ ] PDF opens and navigates in all 3 modes.
