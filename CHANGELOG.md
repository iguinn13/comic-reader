# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — unreleased

First version, available for Windows, macOS and Linux.

### Added

- Import of CBZ, ZIP, CBR and PDF via file picker or drag and drop, with a progress panel and cancellation (RF-01..).
- Library with search, filters, sorting, favorites, reading status and a virtualized grid (tested with 5,000 comics).
- Reader with single page, double page and continuous vertical modes, zoom, fullscreen and keyboard shortcuts; PDFs rendered via pdf.js.
- Reading progress saved automatically and resumed on reopen.
- Settings screen: page cache limit, disk usage, data folder.
- Per-user NSIS installer on Windows; the uninstaller asks whether the data should be removed.

### Tests

- Unit suite (Vitest) and E2E (Playwright + Electron): import/read flow, reading modes, deletion, robustness against forced shutdown, and vertical mode memory usage.
