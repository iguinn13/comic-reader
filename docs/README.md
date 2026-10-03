# Comic Reader — Documentation (SDD)

This folder contains the specification for **Comic Reader**, a desktop app (Electron) for reading comics locally from folders chosen by the user, with no login and no network.

The documentation follows the **Spec-Driven Development (SDD)** approach: the specification comes before the code and is the source of truth. Every implemented feature must point to a requirement (`RF-xx` / `RNF-xx`). Any behavior change starts here.

## Index

| # | Document | Purpose |
|---|---|---|
| — | [general.md](general.md) | Original project description (user input, kept as reference) |
| 01 | [01-requisitos.md](01-requisitos.md) | Scope, functional and non-functional requirements, acceptance criteria, traceability |
| 02 | [02-arquitetura.md](02-arquitetura.md) | Electron processes, layers, folder structure, `comic://` protocol, security |
| 03 | [03-modelo-de-dados.md](03-modelo-de-dados.md) | SQLite schema, integrity rules, on-disk file layout |
| 04 | [04-contratos-ipc.md](04-contratos-ipc.md) | Typed API exposed to the renderer (`window.api`), events and errors |
| 05 | [05-importacao.md](05-importacao.md) | Root folder scanning and indexing of CBZ/CBR/ZIP/PDF |
| 06 | [06-leitor.md](06-leitor.md) | Reader specification: modes, zoom, navigation, shortcuts, progress |
| 07 | [07-ui-ux.md](07-ui-ux.md) | Dark design system, screens, components, states |
| 08 | [08-plano-de-implementacao.md](08-plano-de-implementacao.md) | Ordered milestones and tasks, with a definition of done |
| 09 | [09-testes-e-qualidade.md](09-testes-e-qualidade.md) | Test strategy, fixtures, lint, conventions |
| 10 | [10-decisoes.md](10-decisoes.md) | Architecture decision records (ADRs) |

## Suggested reading order

1. **01-requisitos**: the *what* and the *why*.
2. **07-ui-ux**: how the user sees the app.
3. **02-arquitetura → 03 → 04**: the *how*, from outside in.
4. **05 and 06**: the two areas of highest technical complexity.
5. **08**: where to start implementing.

## How to maintain

- **New or changed requirement** → edit `01-requisitos.md` first (new ID, never reuse a removed ID; mark it as *Removed*).
- **Relevant technical decision** (new dependency, change of strategy) → add an ADR in `10-decisoes.md`.
- **IPC contract or schema change** → update `03`/`04` in the same commit as the code.
- Sections marked **(v2)** are out of scope for the first version, but the design must not preclude them.

## Glossary

| Term | Meaning |
|---|---|
| **Comic** | An indexed issue/magazine: a CBZ, CBR, ZIP or PDF file. `comic` entity in the code. |
| **Library** | The set of all indexed comics, read in-place from the root folders configured by the user (never copied into the app). |
| **Root folder** | Folder chosen by the user in Settings, recursively scanned for comics. `library_folders` entity. |
| **Progress** | Current page of a comic + status (unread / in progress / read). |
| **Reading mode** | How pages are displayed: *single page*, *double page* or *continuous vertical*. |
| **Continuous vertical** | Webtoon-style mode ("portrait with zoom"): pages stacked vertically, adjustable column width. |
| **Spread** | Pair of pages shown side by side in double page mode. |
| **Page cache** | Images extracted from the compressed files, stored on disk for fast reading. |
| **Main / Renderer / Preload** | Electron processes: Node.js (main), React UI (renderer), and the secure bridge between them (preload). |
