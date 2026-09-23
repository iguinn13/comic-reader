# src/shared

Reservado para o código importado por `main`, `preload` **e** `renderer` ao mesmo tempo — por isso nunca pode importar `electron` nem depender do DOM (ver [docs/02-arquitetura.md §4](../../docs/02-arquitetura.md#4-estrutura-de-pastas-do-projeto)).

Estes arquivos entram no milestone **M1 — Dados e contratos** ([docs/08-plano-de-implementacao.md](../../docs/08-plano-de-implementacao.md#m1--dados-e-contratos)), com o contrato completo especificado em [docs/04-contratos-ipc.md](../../docs/04-contratos-ipc.md):

- `types.ts` — DTOs (`ComicSummary`, `CollectionDetail`, …)
- `errors.ts` — `AppErrorCode`, `Result<T>`
- `channels.ts` — nomes dos canais IPC
- `schemas.ts` — validação zod dos inputs
- `api.ts` — a interface `ComicReaderApi` (o contrato de `window.api`)
- `constants.ts` — limites, extensões suportadas, defaults
