# 07 — UI/UX

## 1. Principles

1. **The cover is the protagonist.** The interface is neutral and dark, and the color comes from the comics.
2. **One click to read.** Clicking a card opens the comic. Secondary actions live in hover and the context menu.
3. **Quiet.** There are no unnecessary modals, feedback comes through discreet toasts, and confirmation only appears for destructive actions.
4. **Predictable.** The same controls (search, sort, filters, selection) work the same way across all comic grids.
5. **Dark only.** There is no light mode. `color-scheme: dark` is fixed.

## 2. Design tokens

Defined in `src/renderer/src/styles/globals.css` via Tailwind v4's `@theme`, and used only through the tokens (no loose hex values in components).

### 2.1 Colors

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#0C0C0F` | App background |
| `--color-surface` | `#141418` | Sidebar, collection cards, panels |
| `--color-surface-2` | `#1C1C22` | Hover, inputs, menus, dialogs |
| `--color-border` | `#26262E` | Dividers, subtle borders |
| `--color-text` | `#ECECEF` | Primary text |
| `--color-text-muted` | `#9A9AA6` | Metadata, captions |
| `--color-text-subtle` | `#8A8A97` | Placeholders, disabled (≥ 4.5:1 over `bg`, RNF-10) |
| `--color-accent` | `#F2A93B` | "Old paper" amber: active item, progress, primary button, focus |
| `--color-accent-fg` | `#1A1203` | Text over the accent |
| `--color-success` | `#4CC38A` | "Read" badge, scan complete |
| `--color-danger` | `#EF5B5B` | Delete, errors |
| `--color-reader-bg` | `#08080A` | Reader background |

The contrast of `--color-text-muted` over `--color-bg` must be ≥ 4.5:1 (RNF-10), and this value needs to be validated during implementation.

### 2.2 Typography
- Font: **Inter** (variable, bundled in `assets/fonts`, `font-display: swap`), with fallback `system-ui, "Segoe UI", sans-serif`.
- Scale: `12 / 13 / 14 (base) / 16 / 20 / 24 / 32` px. Page titles at 24 px/600 and card titles at 13 px/500 with a maximum of 2 lines (`line-clamp-2`).
- Tabular numbers (`tabular-nums`) in counters and page indicators.

### 2.3 Space, shape, and motion
- Spacing in multiples of 4 px. Page padding: 32 px (24 px below 1280 px width).
- Radius: 6 px (inputs/buttons), 8 px (covers), 12 px (dialogs/panels).
- Shadows are almost nonexistent. Elevation comes from the surface difference.
- 150 ms `ease-out` transitions (hover, menus) and 200 ms for the reader bars. With `prefers-reduced-motion`, transitions are turned off.
- Focus: 2 px `--color-accent` ring with a 2 px offset (`focus-visible`).

## 3. App shell

```
┌────────────┬──────────────────────────────────────────────────────┐
│ ◧ Comic    │  Library                           🔍 Search…         │
│   Reader   │  [All▾] [☆ Favorites]      Sort: Added ▾              │
│            │                                                      │
│ ⌂ Home     │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│ ▦ Library  │  │cover│ │cover│ │cover│ │cover│ │cover│ │cover│       │
│ ♡ Favorites│  │    │ │    │ │    │ │    │ │    │ │    │            │
│            │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
│            │  Title    Title   Title  ...                          │
│            │  ▬▬▬──                                                │
│            │                                                      │
│ [↻ Refresh]│                                                      │
│            │                                                      │
│ ⚙ Settings │                                                      │
│ «          │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

**Sidebar (RF-60)**
- 232 px wide when expanded and 64 px when collapsed (icons only, with tooltip on hover). The `«` button and `Ctrl+B` toggle it, and below 1100 px width it collapses automatically (without overwriting the saved preference).
- Items: Home, Library, Favorites. The **↻ Refresh library** button (re-scans the root folders) and **Settings** at the bottom, where the root folders live (§4.8).
- Active item: `surface-2` background, `text` color, and a 3 px accent bar on the left.
- Discreet counters to the right of Library and Favorites (`text-subtle`, only in expanded mode).

**Title bar:** `titleBarStyle: 'hidden'` + `titleBarOverlay` in the `--color-bg` color, applied the same way on all three OSes (Windows, macOS, and Linux) — an API officially supported by Electron on all three platforms (ADR-021), so the top area blends into the app. On Windows, it replaces the default frame with custom min/max/close controls in the app's color. On macOS, it keeps the native "traffic lights" repositioned within the overlay area (pending manual visual validation on a real Mac). On Linux, the result may vary between window managers (GNOME/KDE/others).

## 4. Screens

### 4.1 Home (`#/`) — RF-63
```
Welcome back                                        (24px title)

Continue reading                                 See all →
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   ← horizontal scrollable strip,
│ cover│ │ cover│ │ cover│ │      │ │      │     larger cards (180px), with
│▬▬▬───│ │▬───── │ │▬▬▬▬──│ │      │ │      │     progress bar and "p. 12/48"
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘

Recently added                                    See all →
(card strip)
```
- An empty section is hidden. With the entire library empty, it shows the main empty state (§6).
- "See all" on Continue reading → Library with the "In progress" filter and "Recently read" sort.

### 4.2 Library (`#/library`) — RF-10, 12, 13, 18, RF-64
- **View toggle:** "Folders" (default) · "All comics", next to the counter — switches between folder navigation (§4.2.1) and the flat list below. This is local screen state and doesn't persist between sessions.
- **Counter:** "248 comics" (or "12 results for 'batman'"), always the total of the entire library, even in "Folders".
- In **"All comics"**:
  - **Toolbar:** search (with `Ctrl+F` shortcut and a ✕ button to clear), status segmented control (**All · Unread · In progress · Read**), ☆ Favorites toggle, and sort dropdown (Recently added, Recently read, Title A–Z, Title Z–A).
  - **Virtualized grid:** `auto-fill` columns with a 190 px minimum width, 20 px gap, and a 2:3 cover ratio (`object-fit: cover`).
  - **Selection bar** (when there's a selection): replaces the toolbar with "3 selected · Mark as read · Mark as unread · Favorite · Delete · ✕".

#### 4.2.1 Folders (within the Library) — RF-64
```
Library › DC › Year One                     ← breadcrumb, each segment clickable

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  📁      │ │  📁      │ │  COVER  │ │  COVER  │
│Elseworlds│ │ Bronze  │ │ #1      │ │ #2      │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
  8 comics    12 comics   p. 3 of 22   Unread
```
- The same `auto-fill`/190 px/20 px gap grid as the flat list — subfolders appear as cards alongside the comics, with no dedicated side column (in the style of the "Cover" app: clicking enters the folder, the breadcrumb goes back).
- Subfolder card: folder icon + name (max 2 lines) + comic count (recursive); no context menu (it's navigation only — creating/moving folders happens outside the app).
- Top level (before entering any folder): one "folder" per configured root folder (RF-01/03), named after the actual folder name on disk.
- Folder with no subfolders or comics: a simple empty state ("This folder has no comics or subfolders"), with no action — the folder exists on disk, it's just empty.
- A comic card is the same `ComicCard` from §4.3, with the same context menu/selection.

### 4.3 Comic card (`ComicCard` component)
```
┌─────────────┐
│☐          ♥ │ ← checkbox (hover/selection) · heart if favorited
│             │
│    COVER    │   hover: slight zoom (1.03) on the cover + centered ▶ "Read"
│             │         button + ⋯ button in the corner
│ ✓ Read      │ ← badge (green) if read
│▬▬▬▬▬────────│ ← 3px progress bar (accent) if in progress
└─────────────┘
Batman: Year One #1        ← 13px, max 2 lines
p. 12 of 48                ← 12px (or "Unread" / "Read"); the file format isn't shown
```
- Click → read. `Ctrl/Shift+click` → selection. Right click → context menu (RF-19). `Enter` while focused → read.
- A cover not yet generated shows a placeholder with the title over a `surface` gradient.
- Images use `loading="lazy"`, and the fade-in only happens after loading.

### 4.4 Library folders (Settings) — RF-01, RF-03
"Library folders" section at the top of Settings (§4.6):
```
Library folders

┌──────────────────────────────────────────────────┐
│ C:\Users\ana\Comics                           🗑  │
│ D:\Backup\Comics                              🗑  │
└──────────────────────────────────────────────────┘
[ + Add folder ]
```
- **Add folder:** opens the native folder picker dialog (`openDirectory`). On confirmation, the folder is added to the list and a scan runs immediately.
- **Remove** (🗑 per row): removes the folder from the list; comics indexed under it disappear from the library (the files themselves are never touched).
- With no folder configured, the Library and Home show the main empty state (§6) with the same add-folder action.
- The sidebar's **↻ Refresh library** button triggers a new scan of all folders at any time; the icon spins while the scan is in progress (`library:scanProgress`).

### 4.5 Reader (`#/read/:id`)
Specified in [06-leitor.md](06-leitor.md). Visually, the bars use `surface` at 85% opacity and `backdrop-blur`, icons are 20 px, and the height is 48 px (top) and 44 px (bottom).

### 4.6 Settings (`#/settings`)
Single-column sections (max 720 px):
1. **Library folders:** list of root folders with removal and an "Add folder" button (§4.4).
2. **Reading:** default mode (segmented), default fit, default vertical width (slider with preview), and an "Apply defaults to all comics" button (with confirmation).
3. **Storage:** "Library: 248 comics · 12.4 GB", "Cache: 1.1 GB of 2 GB" (bar), limit slider, **Clear cache** button, and **Open data folder** button.
4. **Shortcuts:** the table from [06 §5](06-leitor.md#5-keyboard-shortcuts) (read-only in v1).
5. **Language:** selector (segmented) between Português and English; switching applies immediately, without restarting the app (ADR-022).
6. **About:** version and data folder path.

## 5. Dialogs and feedback

- **Destructive confirmation** (deleting comics): clear title ("Delete 3 comics?"), text explaining the consequence, an optional "Also delete the file from disk" checkbox (unchecked by default), and a `danger`-styled confirm button. Initial focus is on **Cancel**.
- **Toasts** (bottom-left corner, 4 s): "3 comics marked as read". Simple reversible actions (mark as read) offer **Undo** in the toast. Deleting a comic has no undo, which is why it requires confirmation.
- **Menus:** Radix `DropdownMenu`/`ContextMenu` for comic actions (favorite, mark read/unread, rename, delete).

## 6. Empty and error states (RF-62)

| Where | Message | Action |
|---|---|---|
| Empty library (and Home) | Minimalist line illustration + "Your shelf is empty" / "Point to a folder where you already keep your comics (CBZ, CBR, PDF, or ZIP) — the app scans subfolders automatically." | **Add folder** |
| Search with no results | "Nothing found for '…'" | Clear search/filters |
| Empty favorites | "Tap the ♡ on a comic for it to show up here." | — |
| No folder configured | Same message as empty library | **Add folder** |
| Empty folder (folder navigation) | "This folder has no comics or subfolders" | — |
| Comic with missing/corrupted file | "Couldn't open this comic. The file may have been removed or is corrupted." | Back · Remove from library |

## 7. Responsiveness (RNF-08)

| Window width | Behavior |
|---|---|
| < 1100 px | Sidebar collapses automatically; 24 px page padding |
| 1100–1600 px | Default layout |
| > 1600 px | The grid gains more columns (cards don't grow beyond 200 px). Settings content stays centered |
| Any | The reader always uses 100% of the window. The reader bars collapse secondary controls into the `⋯` menu below 1000 px |

## 8. Accessibility (RNF-10)
- All icon-only buttons have an `aria-label` (i18n) and a tooltip.
- Keyboard navigation in grids: `Tab` enters the grid and the arrow keys move between cards (roving tabindex).
- Progress bars use `role="progressbar"` with `aria-valuenow`.
- No information is conveyed by color alone (the "Read" badge has an icon + text).
