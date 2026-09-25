# 07 — UI/UX

## 1. Princípios

1. **A capa é a protagonista.** A interface é neutra e escura, e a cor vem das HQs.
2. **Um clique para ler.** Clicar num card abre a HQ. As ações secundárias ficam no hover e no menu de contexto.
3. **Silencioso.** Não há modais desnecessários, o feedback vem por toasts discretos e a confirmação só aparece em ações destrutivas.
4. **Previsível.** Os mesmos controles (busca, ordenação, filtros, seleção) funcionam igual em todas as grades de HQs.
5. **Só escuro.** Não existe light mode. `color-scheme: dark` fica fixo.

## 2. Design tokens

Definidos em `src/renderer/src/styles/globals.css` via `@theme` do Tailwind v4 e usados só pelos tokens (sem hex solto nos componentes).

### 2.1 Cores

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#0C0C0F` | Fundo do app |
| `--color-surface` | `#141418` | Sidebar, cards de coleção, painéis |
| `--color-surface-2` | `#1C1C22` | Hover, inputs, menus, diálogos |
| `--color-border` | `#26262E` | Divisores, bordas sutis |
| `--color-text` | `#ECECEF` | Texto principal |
| `--color-text-muted` | `#9A9AA6` | Metadados, legendas |
| `--color-text-subtle` | `#8A8A97` | Placeholders, desabilitado (≥ 4,5:1 sobre `bg`, RNF-10) |
| `--color-accent` | `#F2A93B` | Âmbar "papel velho": item ativo, progresso, botão primário, foco |
| `--color-accent-fg` | `#1A1203` | Texto sobre o accent |
| `--color-success` | `#4CC38A` | Selo "Lida", importação ok |
| `--color-danger` | `#EF5B5B` | Excluir, erros |
| `--color-reader-bg` | `#08080A` | Fundo do leitor |
| (modo foco) | `#000000` | Fundo do leitor em modo foco |

O contraste de `--color-text-muted` sobre `--color-bg` deve ser ≥ 4.5:1 (RNF-10), e esse valor precisa ser validado na implementação.

### 2.2 Tipografia
- Fonte: **Inter** (variável, empacotada em `assets/fonts`, `font-display: swap`), com fallback `system-ui, "Segoe UI", sans-serif`.
- Escala: `12 / 13 / 14 (base) / 16 / 20 / 24 / 32` px. Títulos de página em 24 px/600 e títulos de card em 13 px/500 com no máximo 2 linhas (`line-clamp-2`).
- Números tabulares (`tabular-nums`) em contadores e indicadores de página.

### 2.3 Espaço, forma e movimento
- Espaçamento em múltiplos de 4 px. Padding das páginas: 32 px (24 px abaixo de 1280 px de largura).
- Raio: 6 px (inputs/botões), 8 px (capas), 12 px (diálogos/painéis).
- Sombras quase inexistentes. A elevação vem da diferença de superfície.
- Transições de 150 ms `ease-out` (hover, menus) e 200 ms nas barras do leitor. Com `prefers-reduced-motion`, as transições são desligadas.
- Foco: anel de 2 px `--color-accent` com offset de 2 px (`focus-visible`).

## 3. Shell do app

```
┌────────────┬──────────────────────────────────────────────────────┐
│ ◧ Comic    │  Biblioteca                        🔍 Buscar…         │
│   Reader   │  [Todas▾] [☆ Favoritas]   Ordenar: Adicionadas ▾      │
│            │                                                      │
│ ⌂ Início   │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│ ▦ Bibliot. │  │capa│ │capa│ │capa│ │capa│ │capa│ │capa│            │
│ ♡ Favoritas│  │    │ │    │ │    │ │    │ │    │ │    │            │
│ ⧉ Sagas    │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
│ ☰ Listas   │  Título   Título  Título  ...                         │
│            │  ▬▬▬──                                                │
│            │                                                      │
│ [+ Importar]│                                                     │
│            │                                                      │
│ ⚙ Config.  │                                    ┌───────────────┐ │
│ «          │                                    │ Importando 3/7│ │
└────────────┴────────────────────────────────────┴───────────────┴─┘
```

**Sidebar (RF-60)**
- Largura de 232 px expandida e 64 px recolhida (só ícones, com tooltip ao passar). O botão `«` e `Ctrl+B` alternam, e abaixo de 1100 px de largura ela recolhe automaticamente (sem sobrescrever a preferência salva).
- Itens: Início, Biblioteca, Favoritas, Sagas, Listas. O botão primário **+ Importar** fica em destaque (accent) e **Configurações** no rodapé.
- Item ativo: fundo `surface-2`, texto `text` e barra de 3 px accent à esquerda.
- Contadores discretos à direita de Biblioteca, Favoritas, Sagas e Listas (`text-subtle`, só no modo expandido).

**Barra de título:** usa a moldura nativa do Windows com `titleBarStyle: 'hidden'` + `titleBarOverlay` na cor `--color-bg`, para que a área superior se funda ao app. Os controles nativos (min/max/fechar) ficam visíveis.

## 4. Telas

### 4.1 Início (`#/`) — RF-63
```
Olá de volta                                        (título 24px)

Continuar lendo                                  Ver tudo →
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   ← faixa horizontal com scroll,
│ capa │ │ capa │ │ capa │ │ capa │ │ capa │     cards maiores (180px), com
│▬▬▬───│ │▬───── │ │▬▬▬▬──│ │      │ │      │     barra de progresso e "p. 12/48"
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘

Sagas em andamento
[ capa  Guerra Civil   ▬▬▬▬──── 3 de 7   Continuar → ]  (cards horizontais)

Adicionadas recentemente                          Ver tudo →
(faixa de cards)
```
- Uma seção vazia é ocultada. Com a biblioteca inteira vazia, mostra o estado vazio principal (§6).
- "Ver tudo" em Continuar lendo → Biblioteca com filtro "Em andamento" e ordenação "Lidas recentemente".

### 4.2 Biblioteca (`#/library`) — RF-10, 12, 13, 18
- **Toolbar:** busca (com atalho `Ctrl+F` e botão ✕ para limpar), segmented control de status (**Todas · Não lidas · Em andamento · Lidas**), toggle ☆ Favoritas e dropdown de ordenação (Adicionadas recentemente, Lidas recentemente, Título A–Z, Título Z–A).
- **Contador:** "248 HQs" (ou "12 resultados para 'batman'").
- **Grade virtualizada:** colunas `auto-fill` com largura mínima de 150 px, gap de 20 px e proporção da capa 2:3 (`object-fit: cover`).
- **Barra de seleção** (quando há seleção): substitui a toolbar com "3 selecionadas · Adicionar a… · Marcar como lida · Marcar como não lida · Favoritar · Excluir · ✕".

### 4.3 Card de HQ (componente `ComicCard`)
```
┌─────────────┐
│☐          ♥ │ ← checkbox (hover/seleção) · coração se favorita
│             │
│    CAPA     │   hover: leve zoom (1.03) na capa + botão central ▶ "Ler"
│             │         + botão ⋯ no canto
│ ✓ Lida      │ ← selo (verde) se lida
│▬▬▬▬▬────────│ ← barra de progresso 3px (accent) se em andamento
└─────────────┘
Batman: Ano Um #1          ← 13px, 2 linhas máx
p. 12 de 48 · CBZ          ← 12px muted (ou "Não lida" / "Lida")
```
- Clique → lê. `Ctrl/Shift+clique` → seleção. Clique direito → menu de contexto (RF-19). `Enter` com foco → lê.
- A capa ainda não gerada mostra um placeholder com o título sobre um gradiente de `surface`.
- Imagem com `loading="lazy"`, e o fade-in só acontece depois de carregada.

### 4.4 Sagas / Listas (`#/sagas`, `#/lists`) — RF-26
- Cabeçalho "Sagas" + botão **+ Nova saga** + ordenação (Nome, Atualizadas recentemente).
- **Card de coleção:** a capa ganha um efeito "pilha" (2 bordas deslocadas atrás, sugerindo várias revistas), com o nome embaixo e "12 HQs". Na saga, soma-se a barra "5 de 12 lidas".

### 4.5 Detalhe de coleção (`#/collections/:id`) — RF-21..25
```
┌────────┐  SAGA                                        ⋯
│  capa  │  Guerra Civil                                 (Editar, Trocar capa,
│        │  Descrição curta da saga em até 3 linhas…      Converter em lista,
└────────┘  12 HQs · ▬▬▬▬▬────── 5 de 12 lidas            Excluir saga)
            [ ▶ Continuar saga ]  [ + Adicionar HQs ]

  1  ┌────┐ Civil War #1                     Lida     ⠿   ⋯
  2  ┌────┐ Civil War #2                  p. 10/32    ⠿   ⋯
  3  ┌────┐ Front Line #1               Não lida     ⠿   ⋯
```
- **Saga:** exibida em **lista** (linhas com número, miniatura, título e status), com a alça `⠿` de drag & drop (`@dnd-kit`, também acessível por teclado: espaço para pegar e setas para mover). O menu `⋯` da linha tem Mover para o início/fim, Remover da saga e as ações do card.
- **Lista:** exibida em **grade** de cards (igual à Biblioteca, com os mesmos filtros e ordenação), sem numeração.
- **Adicionar HQs:** diálogo com busca e grade compacta com checkboxes. As HQs já presentes aparecem marcadas e desabilitadas. O botão diz "Adicionar (N)".
- **Editar:** diálogo com Nome, Descrição e Tipo (Lista/Saga) (RF-21).
- **Trocar capa:** diálogo com 3 opções em cards selecionáveis: *Automática*, *Escolher imagem…* (diálogo nativo) e *Usar capa de uma HQ* (grade das HQs da coleção) (RF-25).

### 4.6 Painel de importação
- Um cartão flutuante no canto inferior direito (360 px), acima do conteúdo, com o cabeçalho "Importando 3 de 7", botão minimizar e **Cancelar**.
- A lista de itens mostra ícone de estado (relógio · spinner · ✓ · ⊘ duplicado · ⚠ erro), o nome e a mensagem curta de erro.
- Minimizado, vira uma pílula "Importando 3/7" com progresso circular. Um clique expande.
- O resumo final e o diálogo de duplicata estão descritos em [05 §6](05-importacao.md#6-fila-eventos-e-ui).

### 4.7 Leitor (`#/read/:id`)
Especificado em [06-leitor.md](06-leitor.md). Visualmente, as barras usam `surface` com 85% de opacidade e `backdrop-blur`, os ícones têm 20 px e a altura é de 48 px (superior) e 44 px (inferior).

### 4.8 Configurações (`#/settings`)
Seções em coluna única (máx. 720 px):
1. **Leitura:** modo padrão (segmented), ajuste padrão, largura padrão do vertical (slider com preview) e botão "Aplicar padrões a todas as HQs" (com confirmação).
2. **Armazenamento:** "Biblioteca: 248 HQs · 12,4 GB", "Cache: 1,1 GB de 2 GB" (barra), slider de limite, botão **Limpar cache** e botão **Abrir pasta de dados**.
3. **Atalhos:** a tabela de [06 §5](06-leitor.md#5-atalhos-de-teclado) (somente leitura na v1).
4. **Sobre:** versão e caminho da pasta de dados.

## 5. Diálogos e feedback

- **Confirmação destrutiva** (excluir HQs/coleção): título claro ("Excluir 3 HQs?"), texto explicando a consequência e o botão de confirmar em `danger`. O foco inicial fica em **Cancelar**.
- **Toasts** (canto inferior esquerdo, 4 s): "Adicionada a *Guerra Civil*", "3 HQs marcadas como lidas". Ações reversíveis simples (remover da coleção, marcar como lida) oferecem **Desfazer** no toast. A exclusão de HQ não tem desfazer, por isso a confirmação.
- **Menus:** Radix `DropdownMenu`/`ContextMenu`, com submenu "Adicionar a…" mostrando checkboxes (estado vindo de `collections.membership`), separador e "Nova lista…" / "Nova saga…".

## 6. Estados vazios e de erro (RF-62)

| Onde | Mensagem | Ação |
|---|---|---|
| Biblioteca vazia (e Início) | Ilustração minimalista (linha) + "Sua estante está vazia" / "Arraste arquivos CBZ, CBR, PDF ou ZIP para cá, ou importe pelo botão." | **Importar HQs** |
| Busca sem resultado | "Nada encontrado para '…'" | Limpar busca/filtros |
| Favoritas vazia | "Toque no ♡ de uma HQ para ela aparecer aqui." | — |
| Sagas / Listas vazias | "Crie uma saga para organizar uma ordem de leitura." / "Crie listas para agrupar HQs como quiser." | **+ Nova saga** / **+ Nova lista** |
| Coleção vazia | "Esta saga ainda não tem HQs." | **+ Adicionar HQs** |
| HQ com arquivo ausente/corrompido | "Não foi possível abrir esta HQ. O arquivo pode ter sido removido ou estar corrompido." | Voltar · Excluir da biblioteca |

## 7. Responsividade (RNF-08)

| Largura da janela | Comportamento |
|---|---|
| < 1100 px | Sidebar recolhida automaticamente; padding de página de 24 px |
| 1100–1600 px | Layout padrão |
| > 1600 px | Grade ganha mais colunas (cards não crescem além de 200 px). O conteúdo de Configurações fica centralizado |
| Qualquer | O leitor sempre usa 100% da janela. As barras do leitor quebram controles secundários no menu `⋯` abaixo de 1000 px |

## 8. Acessibilidade (RNF-10)
- Todos os botões só com ícone têm `aria-label` (i18n) e tooltip.
- Navegação por teclado nas grades: `Tab` entra na grade e as setas movem entre os cards (roving tabindex).
- As barras de progresso usam `role="progressbar"` com `aria-valuenow`.
- Nenhuma informação é transmitida só por cor (o selo "Lida" tem ícone + texto).
