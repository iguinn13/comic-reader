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
| `--color-success` | `#4CC38A` | Selo "Lida", scan concluído |
| `--color-danger` | `#EF5B5B` | Excluir, erros |
| `--color-reader-bg` | `#08080A` | Fundo do leitor |

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
│            │  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
│            │  Título   Título  Título  ...                         │
│            │  ▬▬▬──                                                │
│            │                                                      │
│ [↻ Atualizar]│                                                    │
│            │                                                      │
│ ⚙ Config.  │                                                      │
│ «          │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

**Sidebar (RF-60)**
- Largura de 232 px expandida e 64 px recolhida (só ícones, com tooltip ao passar). O botão `«` e `Ctrl+B` alternam, e abaixo de 1100 px de largura ela recolhe automaticamente (sem sobrescrever a preferência salva).
- Itens: Início, Biblioteca, Favoritas. O botão **↻ Atualizar biblioteca** (re-escaneia as pastas-raiz) e **Configurações** no rodapé, onde ficam as pastas-raiz (§4.8).
- Item ativo: fundo `surface-2`, texto `text` e barra de 3 px accent à esquerda.
- Contadores discretos à direita de Biblioteca e Favoritas (`text-subtle`, só no modo expandido).

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

Adicionadas recentemente                          Ver tudo →
(faixa de cards)
```
- Uma seção vazia é ocultada. Com a biblioteca inteira vazia, mostra o estado vazio principal (§6).
- "Ver tudo" em Continuar lendo → Biblioteca com filtro "Em andamento" e ordenação "Lidas recentemente".

### 4.2 Biblioteca (`#/library`) — RF-10, 12, 13, 18, RF-64
- **Toggle de visualização:** "Pastas" (padrão) · "Todas as HQs", ao lado do contador — alterna entre a navegação por pastas (§4.2.1) e a lista única abaixo. É estado local da tela, não persiste entre sessões.
- **Contador:** "248 HQs" (ou "12 resultados para 'batman'"), sempre o total da biblioteca inteira, mesmo em "Pastas".
- Em **"Todas as HQs"**:
  - **Toolbar:** busca (com atalho `Ctrl+F` e botão ✕ para limpar), segmented control de status (**Todas · Não lidas · Em andamento · Lidas**), toggle ☆ Favoritas e dropdown de ordenação (Adicionadas recentemente, Lidas recentemente, Título A–Z, Título Z–A).
  - **Grade virtualizada:** colunas `auto-fill` com largura mínima de 190 px, gap de 20 px e proporção da capa 2:3 (`object-fit: cover`).
  - **Barra de seleção** (quando há seleção): substitui a toolbar com "3 selecionadas · Marcar como lida · Marcar como não lida · Favoritar · Excluir · ✕".

#### 4.2.1 Pastas (dentro da Biblioteca) — RF-64
```
Biblioteca › DC › Ano Um                    ← breadcrumb, cada segmento clicável

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  📁      │ │  📁      │ │  CAPA   │ │  CAPA   │
│Elseworlds│ │ Bronze  │ │ #1      │ │ #2      │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
  8 HQs        12 HQs     p. 3 de 22   Não lida
```
- Mesma grade `auto-fill`/190 px/gap 20 px da lista única — as subpastas entram como cards na frente das HQs, sem uma coluna lateral dedicada (estilo do app "Cover": clicar entra na pasta, o breadcrumb volta).
- Card de subpasta: ícone de pasta + nome (2 linhas máx.) + contagem de HQs (recursiva); sem menu de contexto (é só navegação, criar/mover pastas é feito fora do app).
- Nível-topo (antes de entrar em qualquer pasta): uma "pasta" por pasta-raiz configurada (RF-01/03), nomeada pelo nome real da pasta no disco.
- Pasta sem subpastas nem HQs: estado vazio simples ("Esta pasta não tem HQs nem subpastas"), sem ação — a pasta existe no disco, só está vazia.
- Card de HQ é o mesmo `ComicCard` de §4.3, com o mesmo menu de contexto/seleção.

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
p. 12 de 48                ← 12px (ou "Não lida" / "Lida"); o formato do arquivo não é exibido
```
- Clique → lê. `Ctrl/Shift+clique` → seleção. Clique direito → menu de contexto (RF-19). `Enter` com foco → lê.
- A capa ainda não gerada mostra um placeholder com o título sobre um gradiente de `surface`.
- Imagem com `loading="lazy"`, e o fade-in só acontece depois de carregada.

### 4.4 Pastas da biblioteca (Configurações) — RF-01, RF-03
Seção "Pastas da biblioteca" no topo de Configurações (§4.6):
```
Pastas da biblioteca

┌──────────────────────────────────────────────────┐
│ C:\Users\ana\HQs                              🗑  │
│ D:\Backup\Gibis                               🗑  │
└──────────────────────────────────────────────────┘
[ + Adicionar pasta ]
```
- **Adicionar pasta:** abre o diálogo nativo de escolha de pasta (`openDirectory`). Ao confirmar, a pasta entra na lista e um scan roda imediatamente.
- **Remover** (🗑 por linha): tira a pasta da lista; as HQs indexadas sob ela somem da biblioteca (nunca os arquivos).
- Sem nenhuma pasta configurada, a Biblioteca e o Início mostram o estado vazio principal (§6) com a mesma ação de adicionar pasta.
- O botão **↻ Atualizar biblioteca** da sidebar dispara um novo scan de todas as pastas a qualquer momento; o ícone gira enquanto o scan está em andamento (`library:scanProgress`).

### 4.5 Leitor (`#/read/:id`)
Especificado em [06-leitor.md](06-leitor.md). Visualmente, as barras usam `surface` com 85% de opacidade e `backdrop-blur`, os ícones têm 20 px e a altura é de 48 px (superior) e 44 px (inferior).

### 4.6 Configurações (`#/settings`)
Seções em coluna única (máx. 720 px):
1. **Pastas da biblioteca:** lista de pastas-raiz com remoção e botão "Adicionar pasta" (§4.4).
2. **Leitura:** modo padrão (segmented), ajuste padrão, largura padrão do vertical (slider com preview) e botão "Aplicar padrões a todas as HQs" (com confirmação).
3. **Armazenamento:** "Biblioteca: 248 HQs · 12,4 GB", "Cache: 1,1 GB de 2 GB" (barra), slider de limite, botão **Limpar cache** e botão **Abrir pasta de dados**.
4. **Atalhos:** a tabela de [06 §5](06-leitor.md#5-atalhos-de-teclado) (somente leitura na v1).
5. **Sobre:** versão e caminho da pasta de dados.

## 5. Diálogos e feedback

- **Confirmação destrutiva** (excluir HQs): título claro ("Excluir 3 HQs?"), texto explicando a consequência, um checkbox opcional "Apagar também o arquivo do disco" (desmarcado por padrão) e o botão de confirmar em `danger`. O foco inicial fica em **Cancelar**.
- **Toasts** (canto inferior esquerdo, 4 s): "3 HQs marcadas como lidas". Ações reversíveis simples (marcar como lida) oferecem **Desfazer** no toast. A exclusão de HQ não tem desfazer, por isso a confirmação.
- **Menus:** Radix `DropdownMenu`/`ContextMenu` para as ações de HQ (favoritar, marcar lida/não lida, renomear, excluir).

## 6. Estados vazios e de erro (RF-62)

| Onde | Mensagem | Ação |
|---|---|---|
| Biblioteca vazia (e Início) | Ilustração minimalista (linha) + "Sua estante está vazia" / "Aponte para uma pasta onde já ficam suas HQs (CBZ, CBR, PDF ou ZIP) — o app escaneia as subpastas automaticamente." | **Adicionar pasta** |
| Busca sem resultado | "Nada encontrado para '…'" | Limpar busca/filtros |
| Favoritas vazia | "Toque no ♡ de uma HQ para ela aparecer aqui." | — |
| Nenhuma pasta configurada | Mesma mensagem da Biblioteca vazia | **Adicionar pasta** |
| Pasta vazia (navegação por pastas) | "Esta pasta não tem HQs nem subpastas" | — |
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
