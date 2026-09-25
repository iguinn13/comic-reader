# 10 — Registro de decisões (ADR)

Formato: **Contexto → Decisão → Consequências**. Os status possíveis são *Aceita*, *Substituída por ADR-xxx* ou *Rejeitada*. Para reverter uma decisão, crie um ADR novo; não edite o antigo.

---

### ADR-001 — Electron + electron-vite + React + TypeScript
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** O usuário definiu Electron com Vite/TypeScript. Faltava escolher a camada de UI e a ferramenta de build.
**Decisão.** Usar **electron-vite**, que integra o build de main, preload e renderer com HMR, com **React** e **Tailwind v4 + shadcn/ui** (Radix) na UI.
**Consequências.** O ecossistema mais amplo de componentes acessíveis (menus de contexto, diálogos, sliders) acelera as telas. O shadcn copia o código dos componentes para o repo, o que dá controle total do visual escuro. A escolha exige disciplina para não inflar o bundle.

### ADR-002 — SQLite (better-sqlite3) + Drizzle ORM
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** São necessárias consultas com filtro, ordenação e junções (coleções, progresso) sobre milhares de HQs, com integridade referencial.
**Decisão.** Usar **SQLite** via **better-sqlite3** (síncrono e rápido no main) com **Drizzle** (tipos + migrations geradas).
**Alternativas.** JSON em disco (sem consultas, sem integridade, risco de corrupção). `node:sqlite` (API ainda instável entre versões do Node embutido no Electron). IndexedDB no renderer (acopla os dados à UI e dificulta o acesso pelo main).
**Consequências.** O módulo é nativo: o electron-builder faz o rebuild no empacotamento e os testes precisam de estratégia própria ([09 §1](09-testes-e-qualidade.md#1-pirâmide)). As chamadas síncronas são aceitáveis porque as consultas são pequenas, mas qualquer consulta > 16 ms deve ser investigada.

### ADR-003 — Copiar os arquivos importados para uma biblioteca gerenciada
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** Referenciar o arquivo original quebra a HQ se o usuário mover ou apagar o original.
**Decisão.** **Copiar** para `userData/library/{id}.{ext}` (escolha do usuário).
**Consequências.** A leitura fica robusta e independe do original. O custo é espaço em disco duplicado enquanto o usuário mantiver os originais. O tamanho da biblioteca aparece em Configurações (RF-52). Uma v2 pode oferecer "mover" em vez de copiar ou uma pasta de biblioteca configurável.

### ADR-004 — Servir páginas por protocolo customizado `comic://`
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** Enviar imagens por IPC (base64/Buffer) custa CPU e memória e impede o cache e a decodificação assíncrona do Chromium. Expor `file://` exigiria desligar proteções e vazaria caminhos para o renderer.
**Decisão.** Usar o protocolo `comic://` com `protocol.handle`, resolvendo **IDs** para caminhos no main.
**Consequências.** `<img>` e `fetch` nativos, com cache HTTP e `decode()` assíncrono. O renderer nunca conhece caminhos. A URL de capa precisa de versionamento (`?v=`) para invalidar o cache.

### ADR-005 — Extração sob demanda para cache em disco com LRU
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** RAR não permite leitura aleatória eficiente (arquivos sólidos). Extrair tudo na importação dobraria o uso de disco da biblioteca inteira.
**Decisão.** Na importação, apenas **listar** as páginas. Ao **abrir** a HQ, extrair em segundo plano para `cache/pages/{id}`, a partir da página atual, com limite por tamanho (LRU, padrão 2 GB). O ZIP também serve páginas direto do arquivo enquanto a extração não chega.
**Consequências.** A importação é rápida e o disco fica controlado. A primeira abertura de um CBR grande pode demorar mais para as páginas distantes da atual. O cache é descartável.

### ADR-006 — `node-unrar-js` (WASM) para CBR
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** CBR é RAR, que é proprietário. As opções eram um binário `unrar`/`7z` embutido (licença, antivírus, empacotamento por plataforma) ou WASM.
**Decisão.** Usar **node-unrar-js** (unrar compilado para WASM), com suporte a RAR4 e RAR5.
**Consequências.** Sem binários externos nem dependência de plataforma. Precisa do arquivo inteiro em memória (limite prático registrado em [05 §8](05-importacao.md#8-limites-e-desempenho)). Não cria arquivos RAR, o que não é necessário.

### ADR-007 — PDF: `pdf-lib` no main para metadados e `pdf.js` para render
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** O pdf.js em Node precisa de `canvas` nativo. O renderer já tem canvas.
**Decisão.** No main, usar **pdf-lib** (JS puro) só para contar páginas e validar o arquivo. A renderização é feita pelo **pdf.js** no renderer (leitura) e na janela oculta do worker (capa, ADR-008).
**Consequências.** Sem dependências nativas extras. As páginas de PDF são canvas e não `<img>`, então o leitor tem um componente de página específico.

### ADR-008 — Janela oculta para gerar capas de PDF
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** A capa de PDF deve ser gerada durante a importação, que roda no main, mesmo sem nenhuma tela específica aberta.
**Decisão.** Criar uma `BrowserWindow` **oculta** (sandbox, sem preload além do necessário, `show: false`) que carrega o pdf.js e expõe "renderizar página 1 deste comicId em N px → JPEG" via IPC dedicado. Ela é criada sob demanda e destruída após 60 s ociosa.
**Consequências.** A importação fica autocontida e testável (o worker é substituível por fake). O custo é um processo renderer extra durante importações de PDF.

### ADR-009 — Miniaturas com `nativeImage` em vez de `sharp`
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** O `sharp` é excelente, mas é mais um módulo nativo grande para empacotar.
**Decisão.** Usar `nativeImage.createFromBuffer(...).resize({ width, quality: 'good' }).toJPEG(q)`.
**Consequências.** Zero dependências extras. O `nativeImage` não decodifica AVIF e alguns WebP animados: nesses casos a capa fica como placeholder (log) e a leitura segue normal, porque o Chromium decodifica. Se isso virar um problema, um ADR futuro pode adotar o `sharp`.

### ADR-010 — Debounce do progresso no main
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** RF-40 exige nunca perder a página. Um debounce no renderer perde o último valor se o renderer morrer.
**Decisão.** O renderer envia **toda** mudança de página (IPC barato). O main mantém o último valor em memória e grava com debounce de 500 ms, com `flush` síncrono em `reader:close`, `before-quit` e `render-process-gone`.
**Consequências.** No pior caso (queda de energia), perde ≤ 500 ms de progresso (RNF-12). O IPC fica um pouco mais verboso, o que é irrelevante.

### ADR-011 — TanStack Query + Zustand no renderer
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** O renderer consome dados do main (que é a fonte da verdade) e tem estado de UI local (leitor, seleção, sidebar).
**Decisão.** Usar **TanStack Query** para dados vindos do IPC (cache, invalidação, otimismo) e **Zustand** apenas para o estado de UI.
**Consequências.** Não há dados do banco duplicados em stores. A invalidação é centralizada em `query-keys.ts` e disparada também por eventos do main (`library:changed`).

### ADR-012 — Apenas Windows na v1, código multiplataforma
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** O usuário pediu empacotamento só para Windows.
**Decisão.** Distribuir **NSIS x64** na v1, mas não usar APIs exclusivas de Windows sem abstração, e montar caminhos sempre com `path`/`paths.ts`.
**Consequências.** Linux e macOS ficam viáveis na v2, com targets no `electron-builder.yml`. A `titleBarOverlay` tem comportamento diferente no macOS e deve ser revista na v2.

### ADR-013 — Capa de PDF adiada para depois de M2 (sem `pdf-worker`)
**Status:** Aceita · **Data:** 2026-09-23

**Contexto.** ADR-008 previu uma `BrowserWindow` oculta com pdf.js para renderizar a capa de PDFs durante a importação (M2, tarefas 2.3/2.4). Construir e validar essa janela exige um Electron rodando de verdade — algo que o ambiente onde M2 foi implementado não conseguia fazer (o binário do Electron não fica disponível nesse sandbox; ver a nota de ambiente no histórico da sessão). Implementar essa peça sem conseguir executá-la nem uma vez seria construir às cegas.
**Decisão.** M2 entrega a importação de PDF **completa** (RF-01: valida, conta páginas com `pdf-lib`, importa) mas com a **capa em placeholder** (`cover_version = 0`) — um caminho que a própria spec já previa (docs/05-importacao.md §4 passo 7: falha ao gerar capa nunca falha o item). O ponto de extensão fica marcado com um comentário `TODO(M2-follow-up)` em `src/main/services/cover-service.ts`, apontando exatamente onde a chamada ao `pdf-worker` entraria.
**Consequências.** Toda HQ em PDF na biblioteca mostra o placeholder de capa até esta pendência ser retomada — o ideal é junto de **M4.9** (suporte a PDF no leitor), quando o pdf.js já estará sendo integrado no renderer de qualquer forma, reduzindo trabalho duplicado. Nenhuma mudança de assinatura é esperada em `CoverService.generateComicCover` além de passar a receber um `firstPageBuffer` não nulo para PDFs.

> **Atualização (M4.9):** o leitor de PDF (ADR-007) foi implementado — ver ADR-014. A janela oculta do worker de capa (ADR-008) continua pendente; esta ADR-013 segue valendo só para essa parte.

### ADR-014 — pdf.js no leitor: versão fixada em 4.x, `comic://` com CORS, CSP relaxada em dev
**Status:** Aceita · **Data:** 2026-09-24

**Contexto.** M4.9 implementou `PdfPage` (canvas) e `usePdfDocument` (`src/renderer/src/features/reader/`) usando `pdfjs-dist`, conforme ADR-007. Três problemas só apareceram ao rodar o app de verdade (Electron real, não só os testes):
1. `pdfjs-dist` 6.x usa `Map.prototype.getOrInsertComputed` (proposta TC39 recente) internamente, que ainda não existe no V8 empacotado no Electron 39 — o worker quebra com `TypeError` ao carregar qualquer PDF.
2. `pdf.js` só usa `fetch` para `url` com esquema `http(s):` (`isValidFetchUrl`); para `comic:` ele cairia no stream via `XMLHttpRequest`, que o Chromium recusa para esquemas não padrão ("Cross origin requests are only supported for protocol schemes...").
3. O `@vitejs/plugin-react` injeta um `<script>` inline (preamble do Fast Refresh) no HTML servido em dev, que a CSP (`script-src 'self'`) bloqueia — a página inteira quebra com "can't detect preamble", mesmo sem nenhum PDF envolvido.

**Decisão.**
1. Fixar `pdfjs-dist` em `^4.10.38` (linha 4.x), não a última major (6.x).
2. `usePdfDocument` busca os bytes com `fetch(comicFileUrl)` e chama `getDocument({ data })`, nunca `getDocument({ url })` — evita o caminho de rede interno do pdf.js. O protocolo `comic:` ganhou a privilege `corsEnabled: true` (`src/main/protocol.ts`) para esse `fetch` funcionar a partir do renderer.
3. Em dev (`is.dev`), a CSP passa a incluir `'unsafe-inline'` em `script-src`, além do `'unsafe-eval'` já existente. Só se aplica em dev — o preamble do Fast Refresh não existe no build de produção.

**Consequências.** Atualizar `pdfjs-dist` para 5.x/6.x no futuro exige reverificar a compatibilidade com o V8 do Electron da época (item 1) antes de simplesmente subir a versão. `'unsafe-inline'` em `script-src` só em dev é uma relaxação real de CSP, mas sem efeito em produção — o checklist de segurança de [02 §6](02-arquitetura.md#6-segurança) continua valendo para o build empacotado.

### ADR-015 — "Adicionar a…" como diálogo, não submenu
**Status:** Aceita · **Data:** 2026-09-25

**Contexto.** RF-19/RF-23/RF-44 descrevem "Adicionar a…" como submenu com listas, sagas e "Nova lista…/Nova saga…", em três lugares (card, seleção múltipla, leitor). Os wrappers de menu do projeto (`context-menu`, `dropdown-menu`) não têm submenus, e o mesmo fluxo precisa funcionar nos três menus (contexto e dropdown).
**Decisão.** Um único `AddToCollectionDialog` (`features/collections/`), aberto por um item "Adicionar a…" em cada menu. Lista as coleções com check (todas as HQs já estão) ou traço (só parte), alterna ao clicar, e cria coleção nova já com as HQs.
**Consequências.** Um clique a mais que um submenu, em troca de um componente só, com criação inline e busca fácil de estender. Se o submenu for preferido depois, basta trocar o ponto de entrada.

### ADR-016 — Desinstalador pergunta antes de apagar os dados
**Contexto.** `deleteAppDataOnUninstall` do electron-builder apaga tudo sem perguntar; reinstalar/atualizar não pode destruir a biblioteca.
**Decisão.** `deleteAppDataOnUninstall: false` e um macro `customUnInstall` em `build/installer.nsh` com `MessageBox` (padrão: manter). Modo silencioso nunca apaga.
**Consequência.** Testar o instalador em Windows 10/11 limpos (M8.2) precisa ser feito manualmente.
