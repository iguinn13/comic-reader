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
| 0.7 | electron-builder (NSIS x64 no Windows; dmg/zip no macOS; AppImage/deb no Linux — ADR-021) com ícone placeholder e scripts `npm run dist:win`/`dist:mac`/`dist:linux` | Instalador gerado e app abre instalado |
| 0.8 | electron-log configurado e `paths.ts` com todos os diretórios de [03 §3](03-modelo-de-dados.md#3-layout-em-disco) | Log escrito em `userData/logs` |

## M1 — Dados e contratos
**Objetivo:** banco, repositórios e a ponte IPC tipada funcionando ponta a ponta.

| # | Tarefa | RFs |
|---|---|---|
| 1.1 | better-sqlite3 + Drizzle, `schema.ts` completo ([03](03-modelo-de-dados.md)), primeira migration, pragmas e migration no boot (incluindo em build empacotado) | — |
| 1.2 | `src/shared`: `types.ts`, `errors.ts` (`Result`, `AppError`), `channels.ts`, `schemas.ts`, `api.ts` (interface completa, mesmo que os handlers ainda não existam) | — |
| 1.3 | Helper `handle()` do main + preload expondo `window.api` + wrapper `lib/api.ts` + TanStack Query provider | — |
| 1.4 | Repositórios: comics, progress, library_folders e settings, com testes Vitest usando SQLite em memória | — |
| 1.5 | `SettingsService` + IPC `settings:*` + restauração de bounds da janela | RF-61 |
| 1.6 | Script `scripts/seed-dev.ts` (N HQs falsas com capas geradas) | RNF-02 |

## M2 — Biblioteca em pastas (scan)
**Objetivo:** colocar HQs reais dentro do app, lendo direto das pastas do usuário, sem copiar ([05](05-importacao.md)).

> **Revisão pós-v1** (ver [ADR em 10-decisoes.md](10-decisoes.md)): este milestone originalmente implementava um pipeline de *importação* (diálogo de arquivos/drag & drop, cópia para `library/`, fila com resolução interativa de duplicata). Esse modelo foi substituído por escaneamento de pastas-raiz configuradas pelo usuário, in-place. As tarefas abaixo já refletem o modelo atual.

| # | Tarefa | RFs |
|---|---|---|
| 2.1 | Criar as fixtures de teste ([09 §3](09-testes-e-qualidade.md#3-fixtures)) | — |
| 2.2 | `archive/`: `detect.ts` (magic bytes), `ZipArchive` (yauzl), `RarArchive` (node-unrar-js) e `natural-sort`/filtro de páginas, com testes | RF-06 |
| 2.3 | PDF: `pdf-lib` (contagem). ⚠️ **A janela oculta `pdf-worker`/render da capa não foi feita ainda** — ver ADR-013 | RF-06 |
| 2.4 | `CoverService` para capas de HQ (nativeImage) — zip/rar completo; PDF fica com capa placeholder (`TODO(M2-follow-up)` em `cover-service.ts`, ver ADR-013) | RF-06 |
| 2.5 | `library_folders`: repositório e IPC `libraryFolders:*` (diálogo de pasta, listar, remover) | RF-01, RF-03 |
| 2.6 | `walk-directory.ts` (percurso recursivo) + `LibraryScanService` (detectar, validar, hash, dedup, capa, inserir, limpar arquivos ausentes), com testes dos casos de [05 §10](05-importacao.md#10-casos-de-teste-obrigatórios) | RF-02, RF-04, RF-05, RF-06 |
| 2.7 | IPC `library:scan` + eventos `library:scanProgress`/`library:changed`; scan automático no boot | RF-04 |
| 2.8 | UI: seção "Pastas da biblioteca" em Configurações (adicionar/remover), botão "Atualizar biblioteca" na sidebar | RF-01, 03, 04 |
| 2.9 | `MaintenanceService`: limpeza de capas órfãs no boot | RNF-05 |

**Pendência aberta por M2 para M4** (registrada em [ADR-013](10-decisoes.md#adr-013)): a capa de PDF (render da página 1 numa `BrowserWindow` oculta com pdf.js, ADR-008) ainda não existe — HQs em PDF são indexadas normalmente, só ficam com capa placeholder até isso ser retomado, idealmente junto de M4.9 (suporte a PDF no leitor), quando pdf.js já está sendo integrado de qualquer forma.

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
| 4.2 | `ReaderService`: `open` (sessão, prefs mescladas, próximo arquivo da pasta), `setPage` com debounce e flush (`close`, `before-quit`, `render-process-gone`), `savePrefs`/`resetPrefs`, `complete` | RF-30, 40, 41, 42 |
| 4.3 | Rota do leitor, `reader-store`, barras superior/inferior, slider e "Ir para página" | RF-30, 39 |
| 4.4 | Modo **página única** com fit, zoom ancorado, pan e pré-carregamento | RF-31, 34, 43 |
| 4.5 | Navegação por teclado (tabela completa) e mouse (zonas, roda com cooldown, botões laterais) | RF-35, 36 |
| 4.6 | Tela cheia (IPC + evento) com auto-ocultar das barras e do cursor | RF-37, 38 |
| 4.7 | Modo **vertical** virtualizado com largura ajustável e cálculo da página atual | RF-33 |
| 4.8 | Modo **página dupla** (`computeSpreads` com testes, deslocamento) | RF-32 |
| 4.9 | Suporte a **PDF** nos 3 modos (canvas pdf.js, descarte fora da janela) | RF-01 |
| 4.10 | Conclusão automática + painel de fim (sugestão do próximo arquivo da pasta, RF-42) + estado de erro da HQ | RF-42, 62 |
| 4.11 | Tela **Início** com "Continuar lendo" e "Adicionadas recentemente" | RF-11, 63 |

## M5 — (removido na revisão pós-v1)

Este milestone implementava Listas e Sagas (coleções manuais: criar/editar/excluir, adicionar/remover HQs, reordenar saga, capa de coleção, badge e "Próxima da saga" no leitor). A funcionalidade inteira foi removida em favor da organização por pastas do próprio usuário — ver [ADR em 10-decisoes.md](10-decisoes.md) e RF-01 a RF-06. Nada deste milestone permanece no código; "próximo arquivo da pasta" (o substituto funcional de "Próxima da saga") está em M4.10.

## M6 — Configurações e acabamento
| # | Tarefa | RFs |
|---|---|---|
| 6.1 | Tela Configurações: padrões de leitura, "Aplicar a todas", cache (uso, limite, limpar), biblioteca (tamanho, abrir pasta), atalhos, sobre | RF-50..53 |
| 6.2 | Toasts com Desfazer (remover da coleção, marcar lida) | — |
| 6.3 | Painel de atalhos `?` no leitor | RF-35 |
| 6.4 | Revisão de acessibilidade (foco, labels, contraste, teclado nas grades) | RNF-10 |
| 6.5 | Barra de título integrada (`titleBarOverlay`) e ícone definitivo do app, validados nos três SOs (ADR-021) | — |
| 6.6 | Revisão de todos os textos pt-BR e estados vazios | RNF-09, RF-62 |

## M7 — Desempenho, robustez e testes E2E
| # | Tarefa | RNFs |
|---|---|---|
| 7.1 | Seed com 5.000 HQs para medir o boot, a rolagem da grade e a busca, e otimizar o que falhar | RNF-02, 04 |
| 7.2 | HQ de 300 páginas no vertical para medir a memória e ajustar a janela de virtualização | RNF-03 |
| 7.3 | Medição da troca de página e da primeira abertura (log de tempos em dev) | RNF-01 |
| 7.4 | Playwright-Electron: smoke E2E ([09 §2.3](09-testes-e-qualidade.md#23-e2e-playwright--electron)) | — |
| 7.5 | Testes de robustez: matar o app durante a leitura e durante o scan de pastas, e verificar a consistência ao reabrir | RNF-05, 12 |

## M8 — Release v1.0
| # | Tarefa |
|---|---|
| 8.1 | Build final por SO via CI: NSIS no Windows (instalação por usuário, atalho no Menu Iniciar/Desktop, desinstalador que **pergunta** se remove os dados do usuário); dmg/zip no macOS; AppImage/deb no Linux (ADR-021) |
| 8.2 | Teste do instalador numa máquina/VM limpa por SO (Windows 10/11, macOS, Ubuntu/Debian) |
| 8.3 | README do projeto (como rodar, build e onde ficam os dados) |
| 8.4 | Tag `v1.0.0` + CHANGELOG |

---

## Cobertura de requisitos

| RF | Milestone | RF | Milestone |
|---|---|---|---|
| RF-01 | M2 | RF-30 | M4 |
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
| RF-16 | M3 | RF-42 | M4 |
| RF-17 | M3 | RF-43 | M4 |
| RF-18 | M3 | RF-44 | M4 |
| RF-19 | M3 | RF-50..53 | M6 |
| | | RF-60 | M3 |
| | | RF-61 | M1 |
| | | RF-62 | M3, M4, M6 |
| | | RF-63 | M4 |
| | | RF-64 | M3 (pós-v1, ver `docs/10-decisoes.md` ADR-018) |
