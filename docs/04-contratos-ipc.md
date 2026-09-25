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
- **Caminhos de arquivo:** nunca vão por IPC. O renderer só conhece IDs; a resolução de `comics.file_path` fica inteiramente no main (docs/02-arquitetura.md §6).

## 2. Tipos compartilhados (`src/shared/types.ts`)

```ts
export type ComicId = string;
export type ReadStatus = 'unread' | 'reading' | 'read';
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
}

export interface LibraryQuery {
  search?: string;                                   // até 100 chars
  sort: 'title' | 'createdAt' | 'lastReadAt';
  order: 'asc' | 'desc';
  status: 'all' | ReadStatus;
  favoritesOnly: boolean;
  limit: number;                                     // 1..500
  offset: number;
}

export interface Page<T> { items: T[]; total: number }

export interface HomeData {
  continueReading: ComicSummary[];                   // RF-11
  recentlyAdded: ComicSummary[];                      // RF-63
}

export interface LibraryFolder {
  id: string;
  path: string;
  addedAt: number;
}

export interface LibraryScanState {
  scanning: boolean;
  scanned: number;
  added: number;
  removed: number;
}

export interface DeleteComicOptions {
  deleteFile: boolean;                                // RF-17: opt-in explícito
}

export interface FolderLocation {
  folderId: string | null;                            // null = nível-topo (lista as pastas-raiz)
  relativePath: string;                               // "" = raiz da pasta-raiz; "DC/Ano Um" = subpasta
}

export interface FolderEntry {
  name: string;                                       // nome de exibição (basename da pasta)
  folderId: string;
  relativePath: string;
  comicCount: number;                                 // recursivo
  coverUrl: string | null;                            // capa da 1ª HQ direto na pasta; sem HQs diretas, a imagem escolhida pelo usuário (ADR-020) ou null
  hasDirectComics: boolean;                           // só pastas sem HQs diretas aceitam capa própria
}

export interface FolderContents {
  subfolders: FolderEntry[];
  comics: ComicSummary[];                              // no nível-topo: só HQs soltas de pastas-raiz que têm subpastas
}
```

Os tipos do leitor (`ReaderPrefs`, `ReaderMode`, `FitMode`) estão definidos em [03 §2.4](03-modelo-de-dados.md#24-reading_progress).

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
  nextInFolder: ComicSummary | null;                 // próximo arquivo (ordem natural) da mesma pasta (RF-42)
}
```

## 3. Erros

```ts
export type AppErrorCode =
  | 'VALIDATION'           // input inválido
  | 'NOT_FOUND'            // id inexistente
  | 'CONFLICT'             // ex.: pasta-raiz já configurada
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'       // arquivo não abre / sem páginas
  | 'FILE_MISSING'         // arquivo sumiu da pasta do usuário
  | 'IO'                   // erro de disco (sem espaço, permissão)
  | 'CANCELLED'
  | 'INTERNAL';

export interface AppErrorPayload { code: AppErrorCode; message: string; details?: unknown }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload };
```

`message` é uma **chave i18n** (ex.: `errors.fileMissing`) e o renderer traduz. `INTERNAL` sempre é logado com stack no main.

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
| `delete(ids, options)` | `library:delete` | `ComicId[] (1..1000), DeleteComicOptions` | `{ deleted: number }` | RF-17 |
| `stats()` | `library:stats` | — | `{ comicCount; libraryBytes; cacheBytes }` | RF-51, 52 |
| `scan()` | `library:scan` | — | `void` | RF-04 ("Atualizar biblioteca") |
| `browseFolder(location)` | `library:browseFolder` | `FolderLocation` | `FolderContents` | RF-64 |
| `setFolderCover(location)` | `library:setFolderCover` | `FolderLocation` (`folderId` ≠ null) | `boolean` (false = cancelou o seletor de imagem) | RF-64 |
| `clearFolderCover(location)` | `library:clearFolderCover` | `FolderLocation` (`folderId` ≠ null) | `void` | RF-64 |

`delete` com `deleteFile: true` só apaga o arquivo do disco se ele ainda estiver dentro de alguma pasta-raiz configurada (checagem de segurança no `LibraryService`); fora disso, o arquivo é preservado e só o registro é removido, silenciosamente.

`browseFolder` não tem uma tabela de subpastas: agrupa as HQs da pasta-raiz em memória pelo primeiro segmento do caminho relativo a `relativePath` (docs/10 ADR-018). Com `folderId: null`, devolve, para cada pasta-raiz com subpastas, essas subpastas (e as HQs soltas dela em `comics`); para uma pasta-raiz sem subpastas, ela mesma como `subfolder`.

**Eventos**
| Evento | Payload | Quando |
|---|---|---|
| `onScanProgress(cb)` | `LibraryScanState` | A cada arquivo escaneado, e ao concluir |
| `onChanged(cb)` | `{ reason: 'scan' \| 'delete' \| 'cover' }` | HQs indexadas/removidas/capa gerada → renderer invalida as queries |

### 4.2 `libraryFolders`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `list()` | `libraryFolders:list` | — | `LibraryFolder[]` | RF-01, 03 |
| `add()` | `libraryFolders:add` | — | `LibraryFolder \| null` (`null` = diálogo cancelado) | RF-01 |
| `remove(id)` | `libraryFolders:remove` | `string` (UUID) | `void` | RF-03 |

`add` abre o diálogo nativo de escolha de pasta (`dialog.showOpenDialog({ properties: ['openDirectory'] })`) e, ao confirmar, dispara e **espera** um scan completo antes de resolver — a UI já pode consultar `library:list` no retorno. Pasta repetida devolve `CONFLICT`.

### 4.3 `reader`
| Método | Canal | Input | Output | RF |
|---|---|---|---|---|
| `open(comicId)` | `reader:open` | `ComicId` | `ReaderSession` | RF-30, 41, 42 |
| `setPage(comicId, page)` | `reader:setPage` | `ComicId, int ≥ 0` | `void` (*fire-and-forget*, ver abaixo) | RF-40 |
| `savePrefs(comicId, prefs)` | `reader:savePrefs` | `ComicId, ReaderPrefs` | `void` | RF-41 |
| `resetPrefs(comicId)` | `reader:resetPrefs` | `ComicId` | `ReaderPrefs` (defaults) | RF-41 |
| `complete(comicId)` | `reader:complete` | `ComicId` | `void` | RF-42 |
| `reportPageSize(comicId, index, w, h)` | `reader:reportPageSize` | — | `void` | Dimensões de páginas de PDF ou não medidas |
| `close(comicId)` | `reader:close` | `ComicId` | `void` | flush imediato do progresso |

**Semântica de `setPage`:** o renderer chama a cada mudança de página (sem debounce). O main guarda o valor em memória e grava no banco com debounce de 500 ms por HQ. `close`, `before-quit` e `render-process-gone` forçam o flush. Isso atende RF-40 e RNF-12.

`open` dispara em segundo plano a extração da HQ para o cache (`PageCacheService.ensure(comicId)`), priorizando a página atual e as seguintes. Se o arquivo não existe mais na pasta do usuário, retorna `FILE_MISSING`, e se não abre, `CORRUPTED_FILE` (RF-62).

### 4.4 `settings`
| Método | Canal | Input | Output |
|---|---|---|---|
| `get()` | `settings:get` | — | `Settings` (todas as chaves com defaults aplicados) |
| `update(patch)` | `settings:update` | `Partial<Settings>` (validado por chave) | `Settings` |
| `resetAllReaderPrefs()` | `settings:resetAllReaderPrefs` | — | `void` (RF-50 "Aplicar a todas") |

### 4.5 `app`
| Método | Canal | Output |
|---|---|---|
| `info()` | `app:info` | `{ version; userDataPath }` |
| `openDataFolder()` | `app:openDataFolder` | `void` (`shell.openPath`) |
| `clearCache()` | `app:clearCache` | `{ freedBytes }` |
| `toggleFullscreen(force?: boolean)` | `app:toggleFullscreen` | `boolean` (novo estado; com `force` define o estado em vez de alternar) |
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
