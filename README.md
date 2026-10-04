# Comic Reader

**Your comic shelf, offline and distraction-free.**

[![Build](https://github.com/iguinn13/comic-reader/actions/workflows/build.yml/badge.svg)](https://github.com/iguinn13/comic-reader/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)

Comic Reader is a desktop app for the fan who already keeps their CBZ, CBR, PDF, and ZIP comics organized in folders on their computer. Point it at one or more root folders — it scans them recursively, including subfolders — and it indexes what it finds, **without ever copying, moving, or modifying your files**. Organizing stays exactly as it is on disk; the app only takes care of comfortable reading and remembering where you left off.

It's **offline and local by design**: no account, no server, no telemetry, no network calls. Everything — your library index, covers, reading progress, and settings — lives in a local SQLite database on your machine.

## Features

- **In-place library.** Point at your existing folders; nothing is copied or reorganized. Remove a folder and the app forgets it, your files are untouched.
- **Three reading modes.** Single page, double page (with spread detection and pair offsetting), and continuous vertical, all with zoom and fullscreen.
- **Picks up where you left off.** Progress is saved automatically per comic, with a "Continue reading" row on the Home screen.
- **Smart "what's next."** Finish a comic and it suggests the next file, in natural order, from the same folder.
- **Fast, filterable library.** Search, sort, and filter by read status or favorites, with a virtualized grid that stays smooth at thousands of comics.
- **Folder browsing.** Navigate your library the way it's actually organized on disk, or switch to a flat "all comics" view.
- **Bilingual UI.** Português (pt-BR) and English (en-US), switchable anytime from Settings — no restart needed.
- **Dark, quiet interface.** No light mode, no clutter, covers do the talking.
- **Cross-platform.** Native installers for Windows, macOS (Intel and Apple Silicon), and Linux.

## Installation

Grab the latest build from the [Releases page](https://github.com/iguinn13/comic-reader/releases/latest).

- **Windows:** download `comic-reader-<version>-setup.exe` and run it. The install is per-user (no admin prompt), creates shortcuts in the Start Menu and on the Desktop, and lets you pick the folder. On uninstall, the program **asks** whether your library data should also be removed.
- **macOS:** download `comic-reader-<version>-<arch>.dmg` (`x64` or `arm64`), open it, and drag the app into Applications. Since the build is unsigned, Gatekeeper will warn on first launch — right-click the app → "Open" to confirm.
- **Linux:** download the `.AppImage` (make it executable with `chmod +x` and run it directly, no install needed) or the `.deb` (`sudo dpkg -i comic-reader-<version>.deb`, Debian/Ubuntu).

None of the three installers is digitally signed — this is an accepted trade-off for an open-source project with no budget for certificates (see [ADR-021](docs/10-decisoes.md#adr-021--multiplatform-windowsmacoslinux-and-open-source-preparation)), and the OS will warn you on first run as a result.

### Where your data is stored

- **Windows:** `%APPDATA%\Comic Reader\`
- **macOS:** `~/Library/Application Support/Comic Reader/`
- **Linux:** `~/.config/Comic Reader/`

In each: the SQLite database, covers, page cache, and logs — never your comics themselves (the app reads them where they already are; see [ADR-017](docs/10-decisoes.md)). Full layout in [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md).

On uninstall, only the Windows installer asks whether this data should be removed too (see [ADR-016](docs/10-decisoes.md)). On macOS (dragging to the Trash) and Linux (removing the `.AppImage`/`.deb`) there is no such automatic step — to remove the data manually, delete the folder listed above for your OS.

## Getting started

1. Install the app (see above) and open it.
2. From the empty state or Settings, add one or more folders where you keep your comics.
3. The app scans them in the background — browse by folder structure or as a flat list, and start reading.

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests alike. This project follows a spec-first workflow: the documentation under [`docs/`](docs/README.md) is the source of truth, and [`CONTRIBUTING.md`](CONTRIBUTING.md) walks through the setup, conventions, and checklist for a pull request.

## Development

Requires Node 22+ (tested with 24).

```bash
npm install
npm run dev         # app in development, with HMR
npm run typecheck
npm run lint
npm test            # Vitest (runs inside Electron, because of better-sqlite3)
npm run test:e2e    # Playwright + Electron
E2E_MEMORY=1 npm run test:e2e   # includes the memory test (heavy)
```

On Linux/WSL the app disables GPU acceleration automatically. In VS Code, if Electron doesn't open, clear `ELECTRON_RUN_AS_NODE` from the environment.

### Building the installer

```bash
npm run dist:win     # generates dist/comic-reader-<version>-setup.exe (run on Windows)
npm run dist:mac      # generates dist/comic-reader-<version>-<arch>.dmg|.zip (run on macOS)
npm run dist:linux    # generates dist/comic-reader-<version>.AppImage|.deb (run on Linux)
npm run dist          # builds only for the current OS (no platform flag)
```

Native modules (`better-sqlite3`) are rebuilt by the OS where the build runs — it is not possible to generate the installer for one platform from another on a local machine. [CI](.github/workflows/build.yml) builds and tests all three platforms on every push/PR, and publishes the installers as Release artifacts.

The Windows uninstaller is customized in [build/installer.nsh](build/installer.nsh) (no equivalent on macOS/Linux — see "Where your data is stored" above).

## Documentation

The specification in [docs/](docs/README.md) is the source of truth; the architecture rules are in [CLAUDE.md](CLAUDE.md). History in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
