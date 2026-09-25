# 09 — Testes e qualidade

## 1. Pirâmide

| Nível | Ferramenta | Alvo | Onde |
|---|---|---|---|
| Unitário | Vitest (node) | Utils (natural sort, normalize, detect), `computeSpreads`, reducers/hooks de navegação | `*.test.ts` ao lado do arquivo |
| Integração | Vitest (node) + SQLite em memória + fixtures reais | Repositórios, `ImportService`, `CollectionService`, `ReaderService`, `PageCacheService`, archives | `src/main/**/*.test.ts` |
| Componente | Vitest (jsdom) + Testing Library | Componentes com lógica (ComicCard states, toolbar, painel de fim) | `src/renderer/**/*.test.tsx` |
| E2E | Playwright (`_electron.launch`) | Fluxos críticos no app real | `tests/e2e/` |

Os serviços do main recebem as dependências do Electron (`dialog`, `nativeImage`, `BrowserWindow`, `shell`) por injeção. Nos testes elas são substituídas por fakes, e a geração de capa usa um fake que grava um JPEG fixo.

`better-sqlite3` é compilado para o Node do Electron. Para rodar no Node do Vitest, use o script `test` com `electron-rebuild` revertido **ou** execute o Vitest via `ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs`. A decisão fica registrada no `package.json` durante o M0.6.

## 2. O que testar

### 2.1 Obrigatório (integração)
- **Importação:** os 12 casos de [05 §9](05-importacao.md#9-casos-de-teste-obrigatórios).
- **Coleções:** unicidade de nome por tipo (case/acentos), adicionar sem duplicar, remoção renormalizando as posições, `reorder` rejeitando não-permutação, resolução de capa (auto, comic, image e fallback ao remover a HQ), progresso x/y, `nextToRead`, exclusão de coleção sem apagar HQs e exclusão de HQ atualizando as coleções.
- **Progresso:** debounce de `setPage` + `flush()` grava o último valor, `complete` define `completed_at`, "não lida" zera, status derivado correto nos 3 casos, e "Continuar lendo" filtra e ordena corretamente.
- **Biblioteca:** busca sem acento ("acao" → "Ação"), cada filtro de status, favoritas e cada ordenação com desempate estável.
- **Cache:** extração gera arquivos + `.complete`, dimensões gravadas e LRU remove as mais antigas sem tocar a HQ aberta.

### 2.2 Unitário
- `naturalSort`: `['10.jpg','2.jpg','1.jpg']` → `1, 2, 10`, e subpastas.
- `isIgnoredEntry`: `__MACOSX/`, `._x.jpg`, `Thumbs.db`.
- `detectFormat`: assinaturas zip, rar4, rar5, pdf e desconhecida.
- `computeSpreads`: capa sozinha, página larga sozinha, `offset`, página final sem par.
- `titleFromFileName`: `Batman_-_Ano_Um_01.cbz` → `Batman - Ano Um 01`.

### 2.3 E2E (Playwright + Electron)
Cada teste roda com um `userData` temporário (via variável de ambiente `COMIC_READER_USER_DATA`, respeitada só quando `!app.isPackaged` ou em modo de teste).
1. **Importar e ler:** importa um CBZ (bypass do diálogo via `import.start` exposto em modo de teste), abre, avança 3 páginas com `→`, fecha o app, reabre e confirma que está na página 4.
2. **Saga:** cria a saga, adiciona 2 HQs, reordena, lê a última página da primeira e confirma que o painel sugere a segunda.
3. **Modos:** alterna os 3 modos na mesma HQ, sem erros no console.
4. **Exclusão:** exclui a HQ e confirma que ela sumiu da grade e que o arquivo sumiu de `library/`.

O teste de memória (RNF-03, `memory.spec.ts`) gera 300 PNGs e rola a HQ inteira; por ser pesado só roda com `E2E_MEMORY=1`. Os demais (`smoke`, `robustness`) rodam sempre com `npm run test:e2e`.

## 3. Fixtures

Ficam em `tests/fixtures/`. São pequenas (< 1 MB no total) e geradas por `scripts/make-fixtures.ts`, com imagens de 200×300 px numeradas; o arquivo de página larga tem 400×300.

| Arquivo | Conteúdo |
|---|---|
| `simple.cbz` | 5 páginas `01.jpg`..`05.jpg` |
| `natural-order.cbz` | `1.jpg, 2.jpg, 10.jpg, 11.jpg` + `__MACOSX/._1.jpg` + `Thumbs.db` |
| `nested-folders.cbz` | `cap1/1.jpg, cap1/2.jpg, cap2/1.jpg` |
| `wide-page.cbz` | 6 páginas, com a 3 larga |
| `simple-rar4.cbr` / `simple-rar5.cbr` | 3 páginas (gerados uma vez com o `rar` CLI e commitados) |
| `zip-as-cbr.cbr` | ZIP com extensão `.cbr` |
| `simple.pdf` | 3 páginas |
| `pack.zip` | `a.cbz`, `b.cbz`, `c.cbr`, `d.pdf`, `loose.jpg`, `inner.zip` |
| `images-only.zip` | 4 imagens |
| `corrupted.cbz` | `simple.cbz` truncado pela metade |
| `no-images.cbz` | só `ComicInfo.xml` |
| `not-a-comic.epub` | Arquivo qualquer |

## 4. Qualidade de código

- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`, sem `any` (regra `@typescript-eslint/no-explicit-any: error`).
- **ESLint:** `typescript-eslint` recommended-type-checked, `react-hooks`, `jsx-a11y` (recommended) e regra de import proibindo `electron`/`node:*` em `src/renderer` e `src/shared`.
- **Prettier:** 2 espaços, aspas simples, `printWidth: 100`, trailing commas.
- **Nomes:** arquivos em `kebab-case.ts`, componentes em `PascalCase.tsx` e hooks com `useX`. Código e identificadores em **inglês**; textos de UI em pt-BR via i18n; comentários e docs em pt-BR.
- **Commits:** Conventional Commits (`feat(reader): modo vertical virtualizado`), com o RF referenciado quando aplicável (`Refs: RF-33`).
- **Scripts do `package.json`:** `dev`, `build`, `dist`, `typecheck`, `lint`, `format`, `test`, `test:e2e`, `db:generate`, `seed:dev`, `fixtures`.

## 5. Checklist de revisão de PR

- [ ] Cobre um RF/RNF e o cita.
- [ ] Contratos (03/04) atualizados se mudaram.
- [ ] Input de IPC novo tem schema zod.
- [ ] Nenhum caminho de arquivo vindo do renderer (só IDs).
- [ ] Textos novos em `pt-BR.json`.
- [ ] Testes para regra de negócio nova.
- [ ] Sem regressão de desempenho perceptível no leitor.
