# 04 — Contratos IPC

O renderer fala com o main **exclusivamente** por `window.api`, definido em `src/shared/api.ts` e implementado no preload. Esse contrato é a fronteira do sistema: mudou aqui → atualize este documento no mesmo commit.

## 1. Convenções

- **Canais:** `dominio:acao` (ex.: `library:list`), declarados em `src/shared/channels.ts`.
- **Request/response:** `ipcRenderer.invoke` ↔ `ipcMain.handle`.
- **Eventos main → renderer:** `webContents.send`. O preload expõe `on<Evento>(cb): () => void` (retorna a função de unsubscribe).
- **Validação:** todo input passa por um schema zod (`src/shared/schemas.ts`) no handler. Falha gera o erro `VALIDATION`.
- **Retorno:** o handler sempre devolve `Result<T>`. O wrapper `lib/api.ts` do renderer desembrulha e lança `AppError` para o TanStack Query tratar.
- **Serialização:** apenas dados *structured-clone* (sem classes, sem `Date`). Datas são `number` (epoch ms).
- **Imagens:** nunca vão por IPC. Os DTOs trazem URLs `comic://` prontas.

## 2. Tipos compartilhados (`src/shared/types.ts`)

```ts
export type ComicId = string;
export type CollectionId = string;
export type ReadStatus = 'unread' | 'reading' | 'read';
export type CollectionType = 'list' | 'saga';
export type ComicFormat = 'zip' | 'rar' | 'pdf';

export interface ComicSummary {
  id: ComicId;
  title: string;
  format: ComicFormat;
  pageCount: number;
  coverUrl: string | null;        // null → placeholder (capa ainda não gerada)
  isFavorite: boolean;
  status: ReadStatus;
  currentPage: number;            // 0-based
  progress: number;               // 0..1 = (currentPage+1)/pageCount, 1 se lida
  lastReadAt: number | null;
  createdAt: number;
}

export interface ComicDetail extends ComicSummary {
  originalFileName: string;
  fileSize: number;
  collections: { id: CollectionId; type: CollectionType; name: string }[];
}

export interface CollectionSummary {
  id: CollectionId;
  type: CollectionType;
  name: string;
  description: string | null;
  coverUrl: string | null;
  coverMode: 'auto' | 'image' | 'comic';
  itemCount: number;
  readCount: number;              // usado pelas sagas (x de y lidas)
  updatedAt: number;
}

export interface CollectionDetail extends CollectionSummary {
  coverComicId: ComicId | null;
  items: (ComicSummary & { position: number })[];   // ordenados por position
}

export interface LibraryQuery {
  search?: string;                                   // até 100 chars
  sort: 'title' | 'createdAt' | 'lastReadAt';
  order: 'asc' | 'desc';
  status: 'all' | ReadStatus;
  favoritesOnly: boolean;
  collectionId?: CollectionId;                       // filtra dentro de uma lista (RF-24)
  limit: number;                                     // 1..500
  offset: number;
}

export interface Page<T> { items: T[]; total: number }

export interface HomeData {
  continueReading: ComicSummary[];                   // RF-11
  sagasInProgress: CollectionSummary[];              // RF-63
  recentlyAdded: ComicSummary[];                     // RF-63
}
```

Os tipos do leitor (`ReaderPrefs`, `ReaderMode`, `FitMode`) estão definidos em [03 §2.3](03-modelo-de-dados.md#23-reading_progress).

```ts
export interface ReaderPage {
  index: number;
  url: string;                                       // comic://page/{id}/{index}
  width: number | null;
  height: number | null;
}

export interface ReaderSession {
  comic: ComicDetail;
  source:                                            // como renderizar
    | { kind: 'images'; pages: ReaderPage[] }        // CBZ/CBR
    | { kind: 'pdf'; fileUrl: string };              // comic://file/{id}
  currentPage: number;
  prefs: ReaderPrefs;                                // já mesclado: prefs da HQ ?? defaults
  hasCustomPrefs: boolean;
  sagaContext: SagaContext[];                        // sagas que contêm a HQ (RF-42)
}

export interface SagaContext {
  sagaId: CollectionId;
  sagaName: string;
  position: number;                                  // 0-based
  total: number;
  next: ComicSummary | null;
}
```

## 3. Erros

```ts
export type AppErrorCode =
  | 'VALIDATION'           // input inválido
  | 'NOT_FOUND'            // id inexistente
  | 'CONFLICT'             // ex.: nome de coleção duplicado
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'       // arquivo não abre / sem páginas
  | 'FILE_MISSING'         // arquivo da biblioteca sumiu do disco
  | 'IO'                   // erro de disco (sem espaço, permissão)
  | 'CANCELLED'
  | 'INTERNAL';

export interface AppErrorPayload { code: AppErrorCode; message: string; details?: unknown }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload };
```

`message` é uma **chave i18n** (ex.: `errors.collectionNameTaken`) e o renderer traduz. `INTERNAL` sempre é logado com stack no main.

## 4. API (`window.api`)

### 4.1 `library`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `home()` | `library:home` | — | `HomeData` | RF-11, RF-63 |
| `list(q)` | `library:list` | `LibraryQuery` | `Page<ComicSummary>` | RF-10, 12, 13, 15 |
| `get(id)` | `library:get` | `ComicId` | `ComicDetail` | — |
| `rename(id, title)` | `library:rename` | `ComicId, string(1..200)` | `ComicSummary` | RF-16 |
| `setFavorite(ids, value)` | `library:setFavorite` | `ComicId[] (1..1000), boolean` | `void` | RF-15 |
| `setReadStatus(ids, status)` | `library:setReadStatus` | `ComicId[], 'read'\|'unread'` | `void` | RF-14 |
| `removeFromContinue(id)` | `library:removeFromContinue` | `ComicId` | `void` | RF-11 |
| `delete(ids)` | `library:delete` | `ComicId[] (1..1000)` | `{ deleted: number }` | RF-17 |
| `stats()` | `library:stats` | — | `{ comicCount; libraryBytes; cacheBytes }` | RF-51, 52 |

### 4.2 `importer`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `pickFiles()` | `import:pickFiles` | — | `string[]` (vazio se cancelado) | RF-01 |
| `pathsForFiles(files)` | *(preload, síncrono)* | `File[]` | `string[]` via `webUtils.getPathForFile` | RF-02 |
| `start(paths)` | `import:start` | `string[] (1..5000)` | `{ jobId: string }` | RF-01..04 |
| `cancel(jobId)` | `import:cancel` | `string` | `void` | RF-04 |
| `resolveDuplicate(jobId, itemId, decision, applyToAll)` | `import:resolveDuplicate` | `…, 'skip'\|'import', boolean` | `void` | RF-05 |
| `getJob()` | `import:getJob` | — | `ImportJobState \| null` | reidratar UI após reload |

Se `start` for chamado com um job em andamento, os itens **entram no job atual** (a fila é única).

**Eventos**
| Evento | Payload | Quando |
|---|---|---|
| `onImportProgress(cb)` | `ImportJobState` | A cada mudança de estado de item (com throttle de 100 ms) |
| `onLibraryChanged(cb)` | `{ reason: 'import' \| 'delete' \| 'cover' }` | HQs criadas/removidas/capa gerada → renderer invalida as queries |

```ts
export type ImportItemStatus =
  | 'queued' | 'processing' | 'awaiting-duplicate-decision'
  | 'done' | 'skipped-duplicate' | 'failed' | 'cancelled';

export interface ImportItem {
  id: string;
  sourceName: string;           // nome exibido (para itens de ZIP: "pack.zip › Batman 01.cbz")
  status: ImportItemStatus;
  errorCode?: AppErrorCode;
  comicId?: ComicId;            // quando done
  duplicateOf?: { id: ComicId; title: string };
}

export interface ImportJobState {
  jobId: string;
  status: 'running' | 'paused-for-decision' | 'finished' | 'cancelled';
  items: ImportItem[];
  counts: { total: number; done: number; skipped: number; failed: number };
  startedAt: number;
  finishedAt: number | null;
}
```

### 4.3 `collections`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `list(type, sort)` | `collections:list` | `CollectionType, 'name'\|'updatedAt'` | `CollectionSummary[]` | RF-26 |
| `get(id)` | `collections:get` | `CollectionId` | `CollectionDetail` | RF-24 |
| `create(input)` | `collections:create` | `{ type; name; description?; comicIds? }` | `CollectionSummary` | RF-20 |
| `update(id, patch)` | `collections:update` | `{ name?; description?; type? }` | `CollectionSummary` | RF-21 |
| `delete(id)` | `collections:delete` | `CollectionId` | `void` | RF-22 |
| `addItems(id, comicIds)` | `collections:addItems` | `CollectionId, ComicId[]` | `{ added: number }` | RF-23 |
| `removeItems(id, comicIds)` | `collections:removeItems` | `CollectionId, ComicId[]` | `void` | RF-23 |
| `reorder(id, orderedComicIds)` | `collections:reorder` | lista **completa** na nova ordem | `void` | RF-24 |
| `setCover(id, cover)` | `collections:setCover` | `{mode:'auto'} \| {mode:'comic', comicId} \| {mode:'image', path}` | `CollectionSummary` | RF-25 |
| `pickCoverImage()` | `collections:pickCoverImage` | — | `string \| null` | RF-25 |
| `membership(comicIds)` | `collections:membership` | `ComicId[]` | `Record<CollectionId, 'all'\|'some'>` | Menu "Adicionar a…" com check/indeterminado |
| `nextToRead(sagaId)` | `collections:nextToRead` | `CollectionId` | `ComicId \| null` | RF-24 ("Continuar saga") |

`reorder` valida que `orderedComicIds` é uma permutação exata dos itens atuais. Caso contrário devolve `CONFLICT` e o renderer recarrega.

### 4.4 `reader`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `open(comicId, fromCollectionId?)` | `reader:open` | `ComicId, CollectionId?` | `ReaderSession` | RF-30, 41, 42 |
| `setPage(comicId, page)` | `reader:setPage` | `ComicId, int ≥ 0` | `void` (*fire-and-forget*, ver abaixo) | RF-40 |
| `savePrefs(comicId, prefs)` | `reader:savePrefs` | `ComicId, ReaderPrefs` | `void` | RF-41 |
| `resetPrefs(comicId)` | `reader:resetPrefs` | `ComicId` | `ReaderPrefs` (defaults) | RF-41 |
| `complete(comicId)` | `reader:complete` | `ComicId` | `void` | RF-42 |
| `reportPageSize(comicId, index, w, h)` | `reader:reportPageSize` | — | `void` | Dimensões de páginas de PDF ou não medidas |
| `close(comicId)` | `reader:close` | `ComicId` | `void` | flush imediato do progresso |

**Semântica de `setPage`:** o renderer chama a cada mudança de página (sem debounce). O main guarda o valor em memória e grava no banco com debounce de 500 ms por HQ. `close`, `before-quit` e `render-process-gone` forçam o flush. Isso atende RF-40 e RNF-12.

`open` dispara em segundo plano a extração da HQ para o cache (`PageCacheService.ensure(comicId)`), priorizando a página atual e as seguintes. Se o arquivo não existe, retorna `FILE_MISSING`, e se não abre, `CORRUPTED_FILE` (RF-62).

### 4.5 `settings`
| Método | Canal | Input | Output |
|---|---|---|---|
| `get()` | `settings:get` | — | `Settings` (todas as chaves com defaults aplicados) |
| `update(patch)` | `settings:update` | `Partial<Settings>` (validado por chave) | `Settings` |
| `resetAllReaderPrefs()` | `settings:resetAllReaderPrefs` | — | `void` (RF-50 "Aplicar a todas") |

### 4.6 `app`
| Método | Canal | Output |
|---|---|---|
| `info()` | `app:info` | `{ version; userDataPath }` |
| `openDataFolder()` | `app:openDataFolder` | `void` (`shell.openPath`) |
| `clearCache()` | `app:clearCache` | `{ freedBytes }` |
| `toggleFullscreen()` | `app:toggleFullscreen` | `boolean` (novo estado) |
| `onFullscreenChanged(cb)` | evento | `boolean` |

## 5. Exemplo de implementação (padrão a seguir)

```ts
// src/main/ipc/library.ts
export function registerLibraryIpc(svc: LibraryService) {
  handle(CH.library.rename, z.tuple([zComicId, zTitle]), ([id, title]) => svc.rename(id, title));
}

// src/main/ipc/handle.ts
export function handle<I, O>(channel: string, schema: ZodType<I>, fn: (input: I) => O | Promise<O>) {
  ipcMain.handle(channel, async (_e, ...args): Promise<Result<O>> => {
    const parsed = schema.safeParse(args);
    if (!parsed.success) return err('VALIDATION', 'errors.validation', parsed.error.flatten());
    try { return ok(await fn(parsed.data)); }
    catch (e) { return toResult(e); }  // AppError → error; resto → INTERNAL + log
  });
}

// src/preload/index.ts
const api: ComicReaderApi = {
  library: { rename: (id, title) => ipcRenderer.invoke(CH.library.rename, id, title), /* ... */ },
  // ...
};
contextBridge.exposeInMainWorld('api', api);
```
