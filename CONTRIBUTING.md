# Contributing to Comic Reader

Thanks for your interest in contributing. This project is a desktop comic reader (Electron + React + TypeScript), offline-first, with a spec-first workflow: the documentation under [`docs/`](docs/README.md) is the source of truth, and [`CLAUDE.md`](CLAUDE.md) holds the architecture rules that every change must follow.

## Before you start

Read [`docs/README.md`](docs/README.md) for an index of the specification, and [`CLAUDE.md`](CLAUDE.md) for the non-negotiable architecture rules (what the main process owns, how IPC is validated, where UI strings live, etc.).

The core rule: **every feature maps to a functional requirement (RF) or non-functional requirement (RNF)** in [`docs/01-requisitos.md`](docs/01-requisitos.md). If what you want to build isn't in the spec, or contradicts it, update the spec first (or open an issue to discuss it) — don't just write code that drifts from the documented behavior.

## Prerequisites

- Node 22+ (tested with 24).
- Windows, macOS, or Linux — the app and its build targets support all three (see ADR-021 in [`docs/10-decisoes.md`](docs/10-decisoes.md)).

## Setup

```bash
npm install
npm run dev
```

If Electron doesn't open from inside an IDE terminal, clear any `ELECTRON_RUN_AS_NODE` environment variable left over from a previous run.

## Making a change

1. **Find or write the spec first.** Check [`docs/01-requisitos.md`](docs/01-requisitos.md) for the relevant RF/RNF. For a new feature, add the requirement before writing code.
2. **Follow the architecture rules in `CLAUDE.md`**, in particular:
   - The main process owns all business logic, disk access, and the database. The renderer only displays data and knows IDs — never file paths.
   - Images never cross IPC — use `comic://` URLs.
   - Every IPC handler validates its input with `zod` and returns `Result<T>`.
   - `src/shared` imports neither Node nor DOM APIs; `src/renderer` imports neither `electron` nor `node:*`.
   - UI strings live only in `src/renderer/src/i18n/locales/*.json` (both `pt-BR.json` and `en-US.json` need every key — a test enforces key parity between the two).
   - Code and identifiers are in English. The codebase has no comments by convention — if something is genuinely non-obvious, prefer a clearer name or a short note in the relevant doc under `docs/` instead of an inline comment.
3. **Changed the database schema or the `window.api` contract?** Update [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) and/or [`docs/04-contratos-ipc.md`](docs/04-contratos-ipc.md) in the same commit.
4. **Made an architectural decision** (new dependency, a different strategy for something already decided)? Add an ADR to [`docs/10-decisoes.md`](docs/10-decisoes.md), following the existing Context → Decision → Consequences format. To reverse an earlier decision, add a new ADR and mark the old one as superseded — never edit an accepted ADR's decision in place.

## Before opening a pull request

Run the full local check suite:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm test` runs Vitest inside Electron's bundled Node (required because of `better-sqlite3`'s native binary); `npm run test:e2e` runs Playwright against a real packaged Electron app. Both need to pass.

If your change touches packaging (`electron-builder.yml`, the GitHub Actions workflow), a local `npm run dist:win` (or `dist:mac`/`dist:linux` on the matching OS) is a good sanity check before relying on CI alone.

## Commit messages

This repo loosely follows [Conventional Commits](https://www.conventionalcommits.org/): a short prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`) followed by a concise, present-tense summary. Scope in parentheses is optional but welcome for larger features, e.g. `feat(library): folder browsing (RF-64)`.

## Reporting bugs / proposing features

Open an issue describing the problem or the use case. For anything that would change behavior described in `docs/01-requisitos.md` or an existing ADR, say so explicitly — that's a spec change, not just a bug fix, and it's worth discussing the approach before code is written.
