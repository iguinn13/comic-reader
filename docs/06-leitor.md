# 06 — Leitor

Cobre RF-30 a RF-44. O leitor é a tela mais importante do app e deve ser rápido, silencioso e previsível.

## 1. Rota e ciclo de vida

- Rota: `#/read/:comicId?from=:collectionId`.
- O leitor ocupa a área toda: a sidebar é **escondida** no leitor, que tem o próprio botão "Voltar".
- **Entrada:** `reader.open(comicId, from)` → `ReaderSession`. Enquanto carrega, a tela mostra a capa desfocada + spinner.
- **Saída** (botão Voltar, `Esc` sem nada ativo, ou `Backspace`): `reader.close(comicId)` e volta para a rota anterior (`navigate(-1)`, ou `/library` se não houver histórico).
- **Erros:** `FILE_MISSING` e `CORRUPTED_FILE` mostram um estado de erro com "Voltar" e "Excluir da biblioteca" (RF-62). Uma página individual que falha mostra um placeholder "Não foi possível carregar a página N", e a navegação continua.

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ←  Batman: Ano Um #1          Saga: Ano Um (1/4)    ▣ ▥ ≡  − 100% +  ♡ ⋯  ☾  ⛶ │  ← barra superior
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ‹                        [ PÁGINA ]                           ›    │  ← área de leitura
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━●──────────────────────────   12 / 48   [Ir…]    │  ← barra inferior
└──────────────────────────────────────────────────────────────────────┘
```

- **Barra superior:** voltar; título (clicável → renomear); badge da saga (se aberta de uma saga); seletor de modo (`single` / `double` / `vertical`); controles de ajuste/zoom (dependem do modo); favoritar (RF-44); menu `⋯` (Adicionar a…, Marcar como não lida, Restaurar padrões de leitura); modo foco (☾); tela cheia (⛶).
- **Barra inferior:** slider de páginas (arrastar mostra o preview "página N"), indicador `N / total` (clicável → campo "Ir para página") e setas de navegação.
- **Área de leitura:** fundo `--reader-bg` (quase preto), ou `#000` no modo foco.
- **Auto-ocultar:** em **tela cheia** ou **modo foco**, as barras somem após 2,5 s sem movimento do mouse e reaparecem ao mover o mouse ou aproximá-lo das bordas. O cursor também some quando as barras estão ocultas. Fora desses modos, as barras ficam sempre visíveis.

## 3. Modos de leitura

### 3.1 Página única (`single`) — RF-31

Mostra uma página centralizada. Os ajustes (`fit`) são:
- **Altura** (padrão): a página inteira cabe na altura da área.
- **Largura**: a largura ocupa a área e o excedente vertical é rolável.
- **Original**: 100% dos pixels da imagem.

O **zoom** (RF-34) multiplica o tamanho resultante do `fit` (25%–400%, passos de 10% até 100% e de 25% acima), com o indicador "100%" clicável para resetar.
- Quando a página excede a área, ela pode ser arrastada (pan) com o mouse (cursor `grab`) e rolada com a roda/`↑`/`↓`.
- O zoom com `Ctrl+roda` é ancorado no ponteiro do mouse.
- Ao trocar de página, a rolagem volta ao **topo** da nova página. O zoom/fit se mantém.

### 3.2 Página dupla (`double`) — RF-32

Monta os **spreads** a partir da lista de páginas:
1. A página 0 (capa) fica sempre sozinha.
2. Uma página **larga** (`width > height`, conhecida via `comic_pages` ou medida ao carregar) fica sozinha.
3. As demais formam pares em ordem: `[1,2]`, `[3,4]`, …
4. Com `doubleOffset = true`, a capa passa a ter par e os pares se deslocam em 1 (corrige HQs com páginas duplas "quebradas").
5. Uma página final sem par fica sozinha.

A exibição é **esquerda→direita**, com as duas páginas juntas (sem gap), escaladas com a mesma altura, e o spread inteiro respeita o `fit`/zoom como no modo single. A navegação avança por spread. `current_page` salvo = índice da **primeira** página do spread.

Se as dimensões de uma página ainda não são conhecidas, a montagem assume retrato e é **recalculada** quando a imagem carrega, preservando a página atual visível.

### 3.3 Vertical contínuo (`vertical`) — RF-33 ("portrait com zoom")

- As páginas ficam empilhadas numa coluna centralizada, com gap de 0 px (webtoon), rolagem contínua.
- **Largura da coluna** = `verticalWidth × largura da área` (20%–100%, padrão 60%). É o "zoom" deste modo: `+`/`-`, `Ctrl+roda` e o slider na barra superior alteram a largura em passos de 5%.
- **Virtualização** com `@tanstack/react-virtual`: só as páginas dentro de ±2 viewports ficam montadas (RNF-03). A altura estimada de cada item vem de `width/height` conhecidos (ou 1.5× a largura), e ela é medida e corrigida ao carregar.
- **Página atual** = a página que cruza a linha a 1/3 da altura da viewport. Ela é atualizada durante o scroll (throttle de 150 ms) e reportada via `setPage`.
- Ao abrir ou trocar para este modo, a rolagem posiciona o topo da página atual no topo da viewport.
- Mudar a largura preserva a página atual e a posição relativa dentro dela.

### 3.4 PDF

Funciona nos três modos. O renderer carrega `comic://file/{id}` com o pdf.js (`pdfjs-dist`, worker empacotado localmente) e renderiza cada página num `<canvas>` na resolução `larguraExibida × devicePixelRatio`. Renders fora da janela de pré-carregamento são descartados para liberar memória. Na primeira renderização de cada página, o renderer reporta `reportPageSize` (usado pelo spread e pelos placeholders).

## 4. Navegação — RF-35, RF-36

"Avançar" = próxima página (single), próximo spread (double) ou próxima página alinhada ao topo (vertical).

### 4.1 Mouse
| Ação | single / double | vertical |
|---|---|---|
| Clique no terço esquerdo da área | Voltar | — (sem zonas; o clique não navega) |
| Clique no terço direito | Avançar | — |
| Clique no centro | Mostrar/ocultar barras (em tela cheia/foco) | Mostrar/ocultar barras |
| Roda ↓ / ↑ | Se a página cabe inteira: avançar/voltar (1 troca por gesto, com cooldown de 250 ms). Se excede: rola; no fim/início, mais um gesto troca de página. | Rola normalmente |
| `Ctrl` + roda | Zoom | Largura da coluna |
| Botões laterais do mouse (4/5) | Voltar / Avançar | Voltar / Avançar página |
| Arrastar (com zoom) | Pan | — |
| Duplo clique | Alterna entre `fit` atual e zoom 200% no ponto | Alterna tela cheia |

Os cliques nas zonas não disparam quando o gesto foi um arrasto (pan).

## 5. Atalhos de teclado

Os atalhos ficam ativos apenas na rota do leitor e são ignorados quando o foco está num input.

| Tecla | Ação |
|---|---|
| `→` / `PageDown` | Avançar |
| `←` / `PageUp` | Voltar |
| `Espaço` | Rolar ~85% da viewport para baixo; se já está no fim da página (ou a página cabe), avança |
| `Shift+Espaço` | Inverso do Espaço |
| `↓` / `↑` | Rolar 15% da viewport (quando há excedente) |
| `Home` / `End` | Primeira / última página |
| `G` | Abrir "Ir para página" |
| `1` / `2` / `3` | Modo página única / dupla / vertical |
| `W` | Alternar `fit` Altura ↔ Largura (single/double) |
| `+` / `=` e `-` | Zoom in/out (ou largura, no vertical) |
| `0` | Resetar zoom (100%, ou largura padrão no vertical) |
| `O` | Alternar "Deslocar pares" (double) |
| `F` / `F11` | Tela cheia |
| `L` | Modo foco ("desligar a luz") |
| `S` | Favoritar/desfavoritar |
| `Esc` | Na ordem: fecha o diálogo/menu aberto → sai da tela cheia → sai do modo foco → sai do leitor |
| `Backspace` | Sair do leitor |
| `?` | Mostrar painel de atalhos |

A tabela de atalhos também aparece num diálogo (`?`) e em Configurações.

## 6. Tela cheia e modo foco — RF-37, RF-38

| | Tela cheia | Modo foco |
|---|---|---|
| O que faz | `BrowserWindow.setFullScreen(true)` (via `app.toggleFullscreen`) | Fundo `#000`, barras auto-ocultas, sem bordas nem sombras ao redor da página |
| Persistência | Não persiste (sempre abre em janela) | Persiste globalmente (`reader.focusMode`) |
| Combinável | Sim. A combinação dos dois é a experiência "cinema" |

O renderer escuta `onFullscreenChanged`, porque o usuário pode sair da tela cheia por meios do SO.

## 7. Pré-carregamento e cache — RF-43, RNF-01

**Main (`PageCacheService`)**
- `reader.open` chama `ensure(comicId, startPage)`: se `cache/pages/{id}/.complete` não existe, inicia a extração completa em segundo plano, **a partir da página atual** (ordem: atual → fim → início).
- `comic://page/{id}/{n}`: se o arquivo da página existe no cache, serve direto. Senão, no ZIP lê a entrada direto do arquivo (acesso aleatório) e grava no cache. No RAR, aguarda a extração em andamento chegar à página (a extração RAR é sequencial).
- Na extração, mede a página com `image-size` e grava `width/height` em `comic_pages` (em lote).
- **LRU:** a data de acesso de cada diretório `cache/pages/{id}` fica registrada em memória e persistida no `mtime` do marcador. Quando o total passa de `cache.maxBytes`, remove as HQs menos recentes, nunca a HQ aberta.

**Renderer**
- single/double: pré-carrega (`new Image().src = url` + `decode()`) as **3 próximas** e **1 anterior** páginas/spreads.
- vertical: a virtualização monta ±2 viewports, e as imagens usam `loading="eager"` dentro dessa janela.
- Todas as `<img>` usam `decoding="async"` e `draggable={false}`.

## 8. Progresso — RF-40, RF-41, RF-42

- A cada mudança de página, o renderer chama `reader.setPage(comicId, page)`. O debounce e o flush ficam no main ([04 §4.4](04-contratos-ipc.md#44-reader)).
- `last_read_at` é atualizado em cada gravação.
- **Preferências:** qualquer mudança de modo, fit, zoom, largura ou deslocamento chama `reader.savePrefs` (debounce de 500 ms no renderer). "Restaurar padrões de leitura" (menu `⋯`) chama `resetPrefs`.
- **Conclusão:** quando a última página fica visível (single: exibida; double: último spread exibido; vertical: a última página cruza a linha de 1/3 **ou** o scroll chega ao fim), o renderer chama `reader.complete` uma vez por sessão.
- **Painel de fim:** "avançar" estando no fim abre um overlay centralizado:

```
┌──────────────────────────────────────────────┐
│  ✓ Você terminou "Batman: Ano Um #1"         │
│                                              │
│  Próxima na saga "Ano Um" (2 de 4):          │
│  [capa]  Batman: Ano Um #2        [ Ler → ]  │
│                                              │
│  [ Voltar à biblioteca ]   [ Ficar aqui ]    │
└──────────────────────────────────────────────┘
```

- **Ler →** chama `reader.open(nextId, sagaId)` sem sair da rota (`replace`).
- Com várias sagas: uma linha por saga (no máximo 3). Sem saga ou última da saga: só os botões de baixo.
- `→` no painel ativa o botão focado (padrão: "Ler →" se existir); `Esc` fecha.

## 9. Estado (Zustand `reader-store`)

```ts
interface ReaderState {
  session: ReaderSession | null;
  currentPage: number;
  prefs: ReaderPrefs;
  spreads: number[][];          // derivado (double)
  chromeVisible: boolean;       // barras visíveis
  isFullscreen: boolean;
  focusMode: boolean;
  endPanelOpen: boolean;
  goTo(page: number): void;     // clamp + setPage IPC
  next(): void; prev(): void;
  setPrefs(p: Partial<ReaderPrefs>): void;
}
```

Os componentes de modo (`SingleView`, `DoubleView`, `VerticalView`, e `PdfPage` para páginas de PDF) só consomem o estado. A lógica de navegação fica em hooks testáveis (`useReaderKeyboard`, `useWheelPaging`, `computeSpreads`).

## 10. Critérios de aceite do leitor (resumo para QA)

- [ ] Abrir uma HQ em andamento mostra exatamente a página salva, no modo salvo.
- [ ] Fechar o app com `Alt+F4` no meio da leitura e reabrir volta à mesma página.
- [ ] `←`/`→` funcionam nos 3 modos. Clique nas zonas funciona em single/double.
- [ ] Página larga aparece sozinha no modo duplo. "Deslocar pares" altera o pareamento.
- [ ] No vertical, `+`/`-` muda a largura e a página visível não "pula".
- [ ] Modo foco: fundo preto, barras somem em 2,5 s e voltam com o mouse. Continua ativo ao reabrir o app.
- [ ] Chegar à última página marca como lida, e avançar mostra o painel com a próxima da saga.
- [ ] HQ de 300 páginas no vertical: uso de memória dentro do RNF-03.
- [ ] PDF abre e navega nos 3 modos.
