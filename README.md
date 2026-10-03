# Comic Reader

Desktop app (Electron + React + TypeScript) to import, read and organize comics (CBZ, ZIP, CBR and PDF) locally. Works offline, with no login, a dark theme, and a bilingual interface (pt-BR / en-US). Available for Windows, macOS and Linux (see [ADR-021](docs/10-decisoes.md#adr-021--multiplatform-windowsmacoslinux-and-open-source-preparation)).

## Installation

- **Windows:** download `comic-reader-<version>-setup.exe` and run it. The install is per-user (no admin prompt), creates shortcuts in the Start Menu and on the Desktop, and lets you pick the folder. On uninstall, the program **asks** whether the library should also be removed.
- **macOS:** download `comic-reader-<version>-<arch>.dmg` (`x64` or `arm64`), open it and drag the app into Applications. Since the build is unsigned, Gatekeeper will warn on first launch — right-click the app → "Open" to confirm.
- **Linux:** download the `.AppImage` (make it executable with `chmod +x` and run it directly, no install needed) or the `.deb` (`sudo dpkg -i comic-reader-<version>.deb`, Debian/Ubuntu).

None of the three installers is digitally signed (see ADR-021) — this is an accepted decision for an open-source project with no budget for certificates, and the OS will warn the user on first run.

## Where data is stored

- **Windows:** `%APPDATA%\Comic Reader\`
- **macOS:** `~/Library/Application Support/Comic Reader/`
- **Linux:** `~/.config/Comic Reader/`

In each: the SQLite database, covers, page cache and logs (the app reads comics where they already are, without copying them — see ADR-017). Full layout in [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md).

On uninstall, only the Windows NSIS installer asks whether this data should be removed (ADR-016). On macOS (dragging to the Trash) and Linux (removing the `.AppImage`/`.deb`) there is no such automatic step — to remove the data manually, delete the folder listed above for your OS.

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

## Building the installer

```bash
npm run dist:win     # generates dist/comic-reader-<version>-setup.exe (run on Windows)
npm run dist:mac      # generates dist/comic-reader-<version>-<arch>.dmg|.zip (run on macOS)
npm run dist:linux    # generates dist/comic-reader-<version>.AppImage|.deb (run on Linux)
npm run dist          # builds only for the current OS (no platform flag)
```

Native modules (`better-sqlite3`) are rebuilt by the OS where the build runs — it is not possible to generate the installer for one platform from another on a local machine. [CI](.github/workflows/build.yml) builds and tests all three platforms on every push/PR, and publishes the installers as artifacts of a Release.

The Windows uninstaller is customized in [build/installer.nsh](build/installer.nsh) (no equivalent on macOS/Linux — see "Where data is stored" above).

## Documentation

The specification in [docs/](docs/README.md) is the source of truth; the architecture rules are in [CLAUDE.md](CLAUDE.md). History in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
