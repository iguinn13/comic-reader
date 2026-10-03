# Comic Reader

Desktop app (Electron + electron-vite + React + TypeScript) to import, read and organize comics (CBZ/CBR/PDF/ZIP) locally. It is offline, has no login, and only has a dark theme. The UI is bilingual (pt-BR default + en-US, with a selector in Settings), and the app targets Windows, macOS and Linux (see ADR-021 in `docs/10-decisoes.md`).

## The spec is the source of truth

Before implementing anything, read the relevant part of [docs/](docs/README.md):

- Requirements and acceptance criteria: `docs/01-requisitos.md` (IDs `RF-xx` / `RNF-xx`)
- Architecture and security: `docs/02-arquitetura.md`
- Schema and on-disk layout: `docs/03-modelo-de-dados.md`
- `window.api` contract: `docs/04-contratos-ipc.md`
- Import: `docs/05-importacao.md` · Reader: `docs/06-leitor.md` · UI: `docs/07-ui-ux.md`
- Work order: `docs/08-plano-de-implementacao.md`
- Testing and conventions: `docs/09-testes-e-qualidade.md` · Decisions: `docs/10-decisoes.md`

Rules:
- Every feature points to an RF. If the requested behavior is not in the spec or contradicts the spec, update the spec (or ask) **before** writing code.
- Changed the schema or IPC? Update `03`/`04` in the same commit. New dependency or change of strategy? Add an ADR in `10`.

## Architecture rules

- The main process holds all business logic, the disk and the database. The renderer only presents data and knows only **IDs**, never paths.
- Images never travel over IPC: use `comic://` URLs ([02 §5](docs/02-arquitetura.md#5-the-comic-protocol)).
- Every IPC handler validates its input with zod and returns a `Result<T>`.
- `src/shared` imports neither Node nor the DOM. `src/renderer` imports neither `electron` nor `node:*`.
- UI text only in `src/renderer/src/i18n/locales/pt-BR.json` and `src/renderer/src/i18n/locales/en-US.json`.
- Code and identifiers in English. No comments in source code; documentation in English.

## Commands

The commands start to exist after M0. See the full list in `docs/09-testes-e-qualidade.md` §4.

```bash
npm run dev         # app in development
npm run typecheck   # tsc across the 3 projects
npm run lint
npm test            # Vitest
npm run test:e2e    # Playwright + Electron
npm run dist        # NSIS installer (Windows)
```
