# 08 — Plano de implementação

Os milestones são **verticais e incrementais**: cada um termina com o app rodando e algo utilizável. A ordem minimiza retrabalho: dados e contratos antes de telas, e o leitor antes de coleções (é o núcleo do valor).

**Definição de pronto (vale para toda tarefa)**
- O código segue [02](02-arquitetura.md) e os contratos de [03](03-modelo-de-dados.md)/[04](04-contratos-ipc.md). Se algo mudou, a doc foi atualizada no mesmo commit.
- `npm run typecheck`, `npm run lint` e `npm test` passam.
- Os critérios de aceite dos RFs cobertos foram verificados manualmente com `npm run dev`.
- Os textos novos de UI estão em `pt-BR.json`.

---

## M0 — Fundação do projeto
**Objetivo:** esqueleto rodando com a janela escura e a pipeline de qualidade.

| # | Tarefa | Pronto quando |
|---|---|---|
| 0.1 | Criar o projeto com o template `electron-vite` React + TS, limpar o boilerplate e ajustar o `package.json` (nome `comic-reader`, productName `Comic Reader`) | `npm run dev` abre a janela |
| 0.2 | TS `strict` nos 3 tsconfig, com aliases `@shared`, `@main`, `@renderer` | `npm run typecheck` ok |
| 0.3 | ESLint (flat config, typescript-eslint, react-hooks) + Prettier + scripts `lint`/`format` | lint limpo |
| 0.4 | Tailwind v4 + tokens de [07 §2](07-ui-ux.md#2-design-tokens) + fonte Inter local + shadcn/ui inicializado | Página de teste com botão/inputs no tema |
| 0.5 | Segurança da janela ([02 §6](02-arquitetura.md#6-segurança)): webPreferences, CSP, bloqueio de navegação, single instance, `backgroundColor` e `show` em `ready-to-show` | Checklist marcado |
| 0.6 | Vitest configurado (projeto `main`, ambiente node) + 1 teste de exemplo | `npm test` ok |
| 0.7 | electron-builder (NSIS x64) com ícone placeholder e script `npm run dist` | Instalador gerado e app abre instalado |
| 0.8 | electron-log configurado e `paths.ts` com todos os diretórios de [03 §3](03-modelo-de-dados.md#3-layout-em-disco) | Log escrito em `userData/logs` |

## M1 — Dados e contratos
**Objetivo:** banco, repositórios e a ponte IPC tipada funcionando ponta a ponta.

| # | Tarefa | RFs |
|---|---|---|
| 1.1 | better-sqlite3 + Drizzle, `schema.ts` completo ([03](03-modelo-de-dados.md)), primeira migration, pragmas e migration no boot (incluindo em build empacotado) | — |
| 1.2 | `src/shared`: `types.ts`, `errors.ts` (`Result`, `AppError`), `channels.ts`, `schemas.ts`, `api.ts` (interface completa, mesmo que os handlers ainda não existam) | — |
| 1.3 | Helper `handle()` do main + preload expondo `window.api` + wrapper `lib/api.ts` + TanStack Query provider | — |
| 1.4 | Repositórios: comics, progress, collections, items e settings, com testes Vitest usando SQLite em memória | — |
| 1.5 | `SettingsService` + IPC `settings:*` + restauração de bounds da janela | RF-61 |
| 1.6 | Script `scripts/seed-dev.ts` (N HQs falsas com capas geradas) | RNF-02 |

## M2 — Importação
**Objetivo:** colocar HQs reais dentro do app ([05](05-importacao.md)).

| # | Tarefa | RFs |
|---|---|---|
| 2.1 | Criar as fixtures de teste ([09 §3](09-testes-e-qualidade.md#3-fixtures)) | — |
| 2.2 | `archive/`: `detect.ts` (magic bytes), `ZipArchive` (yauzl), `RarArchive` (node-unrar-js) e `natural-sort`/filtro de páginas, com testes | RF-03, RF-06 |
| 2.3 | PDF: `pdf-lib` (contagem) + janela oculta `pdf-worker` com pdf.js que renderiza a página 1 em JPEG | RF-01 |
| 2.4 | `CoverService` para capas de HQ (nativeImage) | RF-06 |
| 2.5 | `ImportService`: expansão (incl. inspeção de ZIP), pipeline de 8 passos, rollback, fila única, cancelamento e eventos, com testes dos 12 casos de [05 §9](05-importacao.md#9-casos-de-teste-obrigatórios) | RF-03..06 |
| 2.6 | IPC `import:*` + evento `import:progress`/`library:changed` | RF-01, RF-04 |
| 2.7 | UI: botão Importar (diálogo), overlay de drag & drop, `ImportPanel`, diálogo de duplicata e resumo | RF-01, 02, 04, 05 |
| 2.8 | `MaintenanceService`: limpeza de `tmp` e órfãos no boot | RNF-05 |

## M3 — Shell e biblioteca
**Objetivo:** navegar e encontrar as HQs importadas.

| # | Tarefa | RFs |
|---|---|---|
| 3.1 | `AppShell` + `Sidebar` (expandir/recolher, `Ctrl+B`, auto-recolher) + rotas + i18n | RF-60 |
| 3.2 | Protocolo `comic://` (capas primeiro) | — |
| 3.3 | `LibraryService.list` (busca normalizada, filtros, ordenação, paginação) + IPC | RF-10, 12, 13 |
| 3.4 | `ComicCard` + grade virtualizada + toolbar de busca, status, favoritas e ordenação persistidas | RF-10, 12, 13 |
| 3.5 | Favoritar, renomear, marcar lida/não lida, excluir (com confirmação) + menu de contexto | RF-14..17, 19 |
| 3.6 | Seleção múltipla + barra de ações | RF-18 |
| 3.7 | Tela Favoritas (reusa a grade) | RF-15 |
| 3.8 | Estados vazios | RF-62 |

## M4 — Leitor (núcleo)
**Objetivo:** ler com conforto e nunca perder a página ([06](06-leitor.md)).

| # | Tarefa | RFs |
|---|---|---|
| 4.1 | `PageCacheService` (ensure, extração priorizada, dimensões, LRU) + `comic://page` e `comic://file` (com Range) | RF-43, RF-51 |
| 4.2 | `ReaderService`: `open` (sessão, prefs mescladas, contexto de saga), `setPage` com debounce e flush (`close`, `before-quit`, `render-process-gone`), `savePrefs`/`resetPrefs`, `complete` | RF-30, 40, 41, 42 |
| 4.3 | Rota do leitor, `reader-store`, barras superior/inferior, slider e "Ir para página" | RF-30, 39 |
| 4.4 | Modo **página única** com fit, zoom ancorado, pan e pré-carregamento | RF-31, 34, 43 |
| 4.5 | Navegação por teclado (tabela completa) e mouse (zonas, roda com cooldown, botões laterais) | RF-35, 36 |
| 4.6 | Tela cheia (IPC + evento) e **modo foco** com auto-ocultar das barras e do cursor | RF-37, 38 |
| 4.7 | Modo **vertical** virtualizado com largura ajustável e cálculo da página atual | RF-33 |
| 4.8 | Modo **página dupla** (`computeSpreads` com testes, deslocamento) | RF-32 |
| 4.9 | Suporte a **PDF** nos 3 modos (canvas pdf.js, descarte fora da janela) | RF-01 |
| 4.10 | Conclusão automática + painel de fim (sem saga por enquanto) + estado de erro da HQ | RF-42, 62 |
| 4.11 | Tela **Início** com "Continuar lendo" e "Adicionadas recentemente" | RF-11, 63 |

## M5 — Listas e sagas
**Objetivo:** organizar a coleção.

| # | Tarefa | RFs |
|---|---|---|
| 5.1 | `CollectionService`: CRUD, itens, reorder (permutação), resolução de capa, progresso, `nextToRead`, `membership` + IPC + testes | RF-20..25 |
| 5.2 | Telas Sagas/Listas com `CollectionCard` e diálogo Nova/Editar | RF-20, 21, 26 |
| 5.3 | Detalhe da coleção: saga (lista numerada + dnd-kit) e lista (grade) | RF-23, 24 |
| 5.4 | Submenu "Adicionar a…" (card, seleção, leitor) com criação inline + diálogo "Adicionar HQs" | RF-19, 20, 23, 44 |
| 5.5 | Capa de coleção: diálogo de 3 modos, upload de imagem com resize e fallback automático | RF-25 |
| 5.6 | Excluir coleção + converter lista ↔ saga | RF-21, 22 |
| 5.7 | Integração com o leitor: badge da saga, "Próxima da saga" no painel de fim, "Continuar saga", seção "Sagas em andamento" no Início | RF-24, 42, 63 |

## M6 — Configurações e acabamento
| # | Tarefa | RFs |
|---|---|---|
| 6.1 | Tela Configurações: padrões de leitura, "Aplicar a todas", cache (uso, limite, limpar), biblioteca (tamanho, abrir pasta), atalhos, sobre | RF-50..53 |
| 6.2 | Toasts com Desfazer (remover da coleção, marcar lida) | — |
| 6.3 | Painel de atalhos `?` no leitor | RF-35 |
| 6.4 | Revisão de acessibilidade (foco, labels, contraste, teclado nas grades) | RNF-10 |
| 6.5 | Barra de título integrada (`titleBarOverlay`) e ícone definitivo do app | — |
| 6.6 | Revisão de todos os textos pt-BR e estados vazios | RNF-09, RF-62 |

## M7 — Desempenho, robustez e testes E2E
| # | Tarefa | RNFs |
|---|---|---|
| 7.1 | Seed com 5.000 HQs para medir o boot, a rolagem da grade e a busca, e otimizar o que falhar | RNF-02, 04 |
| 7.2 | HQ de 300 páginas no vertical para medir a memória e ajustar a janela de virtualização | RNF-03 |
| 7.3 | Medição da troca de página e da primeira abertura (log de tempos em dev) | RNF-01 |
| 7.4 | Playwright-Electron: smoke E2E ([09 §2.3](09-testes-e-qualidade.md#23-e2e-playwright--electron)) | — |
| 7.5 | Testes de robustez: matar o app durante a leitura e durante a importação, e verificar a consistência ao reabrir | RNF-05, 12 |

## M8 — Release v1.0
| # | Tarefa |
|---|---|
| 8.1 | Build NSIS final (instalação por usuário, atalho no Menu Iniciar/Desktop, desinstalador que **pergunta** se remove os dados do usuário) |
| 8.2 | Teste do instalador numa VM Windows 10 e numa Windows 11 limpas |
| 8.3 | README do projeto (como rodar, build e onde ficam os dados) |
| 8.4 | Tag `v1.0.0` + CHANGELOG |

---

## Cobertura de requisitos

| RF | Milestone | RF | Milestone |
|---|---|---|---|
| RF-01 | M2, M4.9 | RF-30 | M4 |
| RF-02 | M2 | RF-31 | M4 |
| RF-03 | M2 | RF-32 | M4 |
| RF-04 | M2 | RF-33 | M4 |
| RF-05 | M2 | RF-34 | M4 |
| RF-06 | M2 | RF-35 | M4, M6 |
| RF-10 | M3 | RF-36 | M4 |
| RF-11 | M4 | RF-37 | M4 |
| RF-12 | M3 | RF-38 | M4 |
| RF-13 | M3 | RF-39 | M4 |
| RF-14 | M3 | RF-40 | M4 |
| RF-15 | M3 | RF-41 | M4 |
| RF-16 | M3 | RF-42 | M4, M5 |
| RF-17 | M3 | RF-43 | M4 |
| RF-18 | M3 | RF-44 | M5 |
| RF-19 | M3, M5 | RF-50..53 | M6 |
| RF-20..26 | M5 | RF-60 | M3 |
| | | RF-61 | M1 |
| | | RF-62 | M3, M4, M6 |
| | | RF-63 | M4, M5 |
