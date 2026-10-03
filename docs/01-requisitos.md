# 01 — Requisitos

## 1. Visão

Um leitor de HQs desktop, **offline e local**, pensado para o fã que já organiza seus arquivos CBZ/CBR/PDF em pastas no computador. O usuário só aponta o app para uma ou mais pastas-raiz — escaneadas recursivamente, subpastas incluídas — e o app indexa as HQs encontradas ali mesmo, sem copiá-las: organizar em pastas continua sendo trabalho do usuário, fora do app (nos moldes do "Cover" do Windows). O app cuida só da leitura confortável e do progresso.

**Princípios**

1. **Leitura primeiro:** abrir e ler uma HQ deve ser rápido e sem atrito, e o app lembra onde você parou.
2. **Clean e escuro:** visual minimalista e escuro, com a capa das HQs como protagonista.
3. **Local e privado:** sem conta, sem servidor, sem telemetria.

## 2. Escopo

### Dentro do escopo (v1)
- Apontar uma ou mais pastas-raiz (CBZ, CBR, PDF e ZIP), escaneadas recursivamente.
- Ler em três modos: página única, página dupla e vertical contínuo, com zoom, tela cheia.
- Salvar o progresso automaticamente e oferecer a seção "Continuar lendo".
- Ao terminar uma HQ, sugerir o próximo arquivo (ordem natural) da mesma pasta.
- Buscar, filtrar e ordenar a biblioteca, com status lido/não lido e favoritos.
- Interface em pt-BR, estruturada para i18n.
- Empacotamento para Windows 10/11 x64, macOS (x64/arm64) e Linux x64 (AppImage/deb).

### Fora do escopo
- Rede social, comentários, compartilhamento.
- Login, contas, sincronização em nuvem.
- Light mode.
- Organização manual em listas/sagas/coleções — a organização é a estrutura de pastas do próprio usuário (ver `docs/10-decisoes.md`).
- Navegação por árvore de pastas na UI — a biblioteca é uma lista/grade única (ver §4.2).
- Leitura direita→esquerda (mangá). **(v2)**
- Formatos CB7/7z, CBT, EPUB, pasta de imagens. **(v2)**
- Leitura de metadados `ComicInfo.xml`. **(v2)**
- Download/scraping de HQs ou de metadados da internet.
- Edição das imagens das HQs.
- Monitoramento em tempo real das pastas (file watcher). **(v2)** — o app escaneia no boot e sob demanda.
- Auto-update. **(v2)**

## 3. Personas

- **Leitor colecionador:** tem centenas ou milhares de arquivos já organizados em pastas por saga/arco e quer retomar a leitura sem procurar a página.
- **Leitor casual:** aponta o app pra pasta onde já tem suas HQs e só quer abrir e ler com conforto, muitas vezes em tela cheia à noite.

## 4. Requisitos funcionais

Convenção: cada requisito tem um ID estável `RF-xx` e critérios de aceite no formato *Dado / Quando / Então*. Prioridade: **P1** (obrigatório v1) e **P2** (desejável v1, pode ir para o fim do cronograma).

### 4.1 Pastas da biblioteca

Detalhamento completo do algoritmo de scan em [05-importacao.md](05-importacao.md).

**RF-01 — Adicionar pasta-raiz (P1)**
O usuário adiciona uma pasta-raiz pela tela Configurações (ou pelo estado vazio da Biblioteca/Início), que abre o diálogo nativo de escolha de pasta.
- Dado que o usuário escolhe uma pasta, quando confirma o diálogo, então a pasta é salva e escaneada imediatamente.
- Dado que o usuário cancela o diálogo, então nada acontece.
- Adicionar uma pasta já configurada não a duplica (erro silencioso na UI).

**RF-02 — Escaneamento recursivo (P1)**
Cada pasta-raiz é percorrida recursivamente — "pode estar em cadeia", ou seja, subpastas dentro de subpastas — em busca de arquivos `.cbz`, `.cbr`, `.pdf` e `.zip`.
- Dado um arquivo `.zip` contendo só imagens, quando escaneado, então é tratado como uma única HQ (equivalente a CBZ).
- Arquivos com extensão não reconhecida, ou corrompidos/vazios, são ignorados silenciosamente (log interno, sem interromper o scan).

**RF-03 — Múltiplas pastas-raiz (P1)**
O usuário pode configurar várias pastas-raiz independentes (ex.: um HD e um SSD) e removê-las a qualquer momento pela tela Configurações.
- Remover uma pasta-raiz tira do índice todas as HQs encontradas nela (nunca apaga os arquivos originais) — ver RF-06.

**RF-04 — Atualização automática e manual (P1)**
Todas as pastas-raiz são re-escaneadas automaticamente ao abrir o app, e o usuário pode forçar uma atualização a qualquer momento pelo botão "Atualizar biblioteca" da sidebar.
- Um HQ cujo arquivo sumiu de uma pasta desde o último scan é removida do índice silenciosamente (progresso, capa e cache também são limpos).
- O scan roda em segundo plano; o usuário pode continuar navegando e lendo durante o scan.

**RF-05 — Detecção de duplicatas (P1)**
Uma HQ é duplicada se o hash SHA-1 do arquivo já existe na biblioteca (por exemplo, o mesmo arquivo alcançável por duas pastas-raiz sobrepostas).
- Dado um arquivo duplicado, quando encontrado no scan, então ele é ignorado silenciosamente (sem diálogo — o scan é automático e não interativo); a primeira ocorrência indexada é a que permanece.

**RF-06 — Indexação in-place (P1)**
As HQs nunca são copiadas, movidas ou alteradas: o app lê o arquivo original, no lugar onde está.
- O título inicial é o nome do arquivo sem extensão, com `_` e `.` repetidos trocados por espaço e espaços aparados.
- Uma capa (miniatura da primeira página) é gerada e mantida à parte, na pasta de dados do app.
- Dado que o usuário move ou renomeia o arquivo original fora do app, então a HQ some do índice no próximo scan (nada quebra; um novo scan reencontra o arquivo no caminho novo como uma HQ "nova").

### 4.2 Biblioteca

**RF-10 — Biblioteca: todas as HQs (P1)**
A tela "Biblioteca" exibe todas as HQs numa grade de capas (virtualizada) com título, barra de progresso (se em andamento), selo "Lida" e ícone de favorito.
- Clicar no card abre a HQ no leitor, na página salva.

**RF-11 — Continuar lendo (P1)**
A tela "Início" mostra uma faixa "Continuar lendo" com as HQs **em andamento** (página atual > 0 e não lida), ordenadas pela última leitura (mais recente primeiro), com no máximo 20 itens.
- Dado que o usuário terminou uma HQ, então ela sai da faixa.
- Cada card da faixa pode ser removido da faixa com "Remover de Continuar lendo". Isso zera o progresso para 0 (a HQ volta a "não lida").

**RF-12 — Busca (P1)**
Campo de busca na Biblioteca que filtra por título, sem diferenciar maiúsculas nem acentos ("acao" encontra "Ação"), com debounce de 200 ms.

**RF-13 — Ordenação e filtros (P1)**
- Ordenar por: **Título (A–Z / Z–A)**, **Adicionadas recentemente** (padrão), **Lidas recentemente**.
- Filtrar por status: **Todas / Não lidas / Em andamento / Lidas**, e por **Somente favoritas**.
- A escolha de ordenação/filtro persiste entre sessões.

**RF-14 — Status de leitura (P1)**
Toda HQ tem um status derivado: **não lida** (página 0 e nunca concluída), **em andamento** (página > 0, não concluída) ou **lida** (concluída).
- A HQ fica "lida" automaticamente ao chegar à última página (ver RF-42).
- Voltar a ler uma HQ lida (mudar de página) remove o status de lida e a deixa **em andamento**, até chegar de novo à última página.
- O usuário pode marcar manualmente como **lida** ou **não lida** (uma ou várias). "Não lida" zera o progresso.

**RF-15 — Favoritos (P1)**
O usuário pode favoritar/desfavoritar uma HQ pelo card, menu de contexto ou leitor. A sidebar tem a entrada "Favoritas", com a grade das HQs favoritas (mesmos controles da Biblioteca).

**RF-16 — Renomear HQ (P1)**
O usuário pode editar o título de exibição de uma HQ. O arquivo em disco não muda. O título não pode ser vazio (máx. 200 caracteres).

**RF-17 — Excluir HQ (P1)**
O usuário pode excluir uma ou várias HQs, com diálogo de confirmação e uma opção explícita **"Apagar também o arquivo do disco"**, desmarcada por padrão.
- Sem a opção marcada: remove o registro, a capa e o cache de páginas; o arquivo original continua na pasta do usuário e reaparece no próximo scan, a menos que a pasta-raiz seja removida antes (RF-03).
- Com a opção marcada: além do acima, apaga o arquivo original do disco — só se ele ainda estiver dentro de alguma pasta-raiz configurada (checagem de segurança; fora disso, o arquivo é preservado e só o registro é removido).

**RF-18 — Seleção múltipla (P1)**
Nas grades de HQs é possível selecionar várias (checkbox ao passar o mouse, `Ctrl+clique`, `Shift+clique` para intervalo, `Ctrl+A`). Com seleção ativa, uma barra de ações mostra: *Marcar como lida*, *Marcar como não lida*, *Favoritar*, *Excluir*, *Cancelar seleção* (`Esc`).

**RF-19 — Menu de contexto do card (P1)**
Clique direito (ou botão "⋯" no hover) no card de HQ: *Ler*, *Marcar como lida/não lida*, *Favoritar/Desfavoritar*, *Renomear*, *Excluir*.

**RF-64 — Navegação por pastas (P1)**
A Biblioteca tem duas visualizações, alternadas por um botão: **Pastas** (padrão) e **Todas as HQs** (a grade única com busca/filtros/ordenação de RF-10..13).
- Em **Pastas**, a tela mostra a estrutura de pastas do próprio usuário: no nível-topo, cada pasta-raiz configurada (RF-01/RF-03) que tem subpastas não aparece: só as suas filhas (e as HQs soltas dela); uma pasta-raiz sem subpastas aparece ela mesma. Dentro de uma pasta, as subpastas (com a contagem de HQs) e as HQs que estão diretamente ali, na mesma grade — clicar numa subpasta entra nela, com um caminho (breadcrumb) no topo para voltar.
- Uma pasta sem subpastas nem HQs mostra um estado vazio simples.
- Esta navegação é só de leitura: criar/renomear/mover pastas continua sendo feito pelo usuário fora do app (docs/10 ADR).

### 4.4 Leitor

Detalhamento completo em [06-leitor.md](06-leitor.md).

**RF-30 — Abrir HQ (P1)**
Abrir uma HQ mostra o leitor na **página salva**, com o modo e o zoom lembrados para aquela HQ (ou os padrões globais).

**RF-31 — Modo página única (P1)**
Uma página por vez, com os ajustes *Ajustar à altura* (padrão), *Ajustar à largura* e *Tamanho original*.

**RF-32 — Modo página dupla (P1)**
Duas páginas lado a lado. A capa (página 1) fica sozinha, e páginas largas (largura > altura) ficam sozinhas. Uma opção "Deslocar pares" corrige spreads desalinhados.

**RF-33 — Modo vertical contínuo / "portrait com zoom" (P1)**
As páginas ficam empilhadas verticalmente, com scroll contínuo (estilo webtoon). A **largura da coluna** é ajustável (20%–100% da área de leitura, padrão 60%) e fica lembrada por HQ. Esse é o modo para "ler com zoom" de forma confortável.

**RF-34 — Zoom (P1)**
Nos modos de página: zoom de 25% a 400% por `Ctrl+roda`, `+`/`-` e botões, com reset (`0`). Com zoom maior que a área, a página pode ser arrastada (pan). No modo vertical, o zoom altera a largura da coluna.

**RF-35 — Navegação por teclado (P1)**
Setas ←/→ trocam de página (ou spread), além dos demais atalhos da [tabela do leitor](06-leitor.md#5-atalhos-de-teclado).

**RF-36 — Navegação por mouse (P1)**
Clique na zona esquerda/direita da página volta/avança, a roda do mouse navega, os botões laterais do mouse (voltar/avançar) trocam de página e há botões de seta visíveis na barra do leitor.

**RF-37 — Tela cheia (P1)**
Alternar tela cheia com `F11`/`F` ou botão, e sair com `Esc`.

**RF-38 — (removido)** Modo foco descartado, ver ADR-019.

**RF-39 — Indicador e salto de página (P1)**
Barra inferior com slider de progresso, "página X de Y" e campo "Ir para página". `Home`/`End` vão para a primeira/última.

**RF-40 — Salvamento automático do progresso (P1)**
A página atual é persistida a cada mudança e garantidamente ao fechar o leitor, ao fechar o app ou em crash do renderer. Reabrir o app e a HQ volta à mesma página.

**RF-41 — Preferências por HQ (P1)**
O modo de leitura, o ajuste/zoom e a largura vertical escolhidos numa HQ ficam lembrados para ela. HQs nunca abertas usam os padrões globais (RF-50).

**RF-42 — Fim da HQ (P1)**
- Ao exibir a última página (ou último spread; no vertical, ao rolar até o fim), a HQ é marcada como **lida**.
- Tentar avançar além da última página exibe o painel de fim: "Você terminou *Título*", com **"Continuar: *Título do próximo arquivo*"** (se houver outro arquivo na mesma pasta, em ordem natural, depois do atual), "Voltar à biblioteca" e "Continuar lendo aqui".
- O "próximo arquivo" é puramente posicional (ordem natural dos nomes de arquivo dentro da pasta) — não depende de nenhuma organização manual do usuário.

**RF-43 — Pré-carregamento (P1)**
Páginas vizinhas são pré-carregadas para que a troca de página seja instantânea (ver RNF-01).

**RF-44 — Ações da HQ dentro do leitor (P2)**
Favoritar também está acessível na barra superior do leitor.

### 4.5 Configurações

**RF-50 — Padrões de leitura (P1)**
Modo de leitura padrão, ajuste padrão (página única), largura padrão do vertical e "Aplicar a todas as HQs" (limpa as preferências por HQ).

**RF-51 — Cache (P1)**
Mostra o uso atual do cache de páginas, permite definir o limite (512 MB – 20 GB, padrão 2 GB) e o botão "Limpar cache".

**RF-52 — Biblioteca em disco (P1)**
Mostra o tamanho total da biblioteca e a quantidade de HQs, com o botão "Abrir pasta de dados".

**RF-53 — Sobre (P2)**
Versão do app e caminho da pasta de dados.

### 4.6 Geral / Shell

**RF-60 — Sidebar (P1)**
Menu lateral esquerdo fixo com: **Início**, **Biblioteca**, **Favoritas**, botão **Atualizar biblioteca** (re-escaneia as pastas-raiz, RF-04) e **Configurações** (rodapé, onde ficam as pastas-raiz, RF-01/03). Pode ser recolhida para ícones (botão ou `Ctrl+B`) e o estado persiste. O item ativo fica destacado.

**RF-61 — Estado da janela (P1)**
Tamanho, posição e estado maximizado da janela são restaurados ao reabrir. A janela mínima é de 960×600.

**RF-62 — Estados vazios e de erro (P1)**
Toda tela tem um estado vazio com orientação (ex.: biblioteca vazia → "Arraste suas HQs aqui ou clique em Importar"). Uma HQ cujo arquivo sumiu ou corrompeu mostra um erro no leitor com a opção "Excluir da biblioteca".

**RF-63 — Tela Início (P1)**
Contém: "Continuar lendo" (RF-11) e "Adicionadas recentemente" (últimas 20 HQs).

## 5. Requisitos não funcionais

| ID | Categoria | Requisito | Como medir |
|---|---|---|---|
| RNF-01 | Desempenho | Troca de página < 100 ms com pré-carregamento. Primeira página de um CBZ de até 150 MB visível em < 2 s na primeira abertura, e < 500 ms quando já está em cache. | Log de tempos em dev + teste manual com fixture grande |
| RNF-02 | Escala | Biblioteca com 5.000 HQs: grade rolando a 60 fps (virtualizada), busca/filtro respondendo em < 200 ms e boot até a tela Início em < 3 s. | Script de seed com 5.000 registros |
| RNF-03 | Memória | Renderer < 600 MB lendo uma HQ de 300 páginas no modo vertical (virtualização: só páginas próximas montadas no DOM). | Gerenciador de tarefas / `process.getProcessMemoryInfo` |
| RNF-04 | Fluidez | Scroll do modo vertical e das grades a 60 fps em hardware médio (i5, 8 GB, SSD). | DevTools Performance |
| RNF-05 | Robustez | Uma falha num arquivo não interrompe o scan. Operações de banco que tocam várias tabelas são transacionais. O boot limpa capas órfãs (sem HQ correspondente) e remove do índice HQs cujo arquivo sumiu da pasta. | Testes unitários + teste de scan interrompido |
| RNF-06 | Segurança | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP estrita, sem `remote`, todo input de IPC validado com zod e caminhos de arquivo nunca montados a partir de strings do renderer (só IDs). | Checklist em [02-arquitetura.md](02-arquitetura.md#6-segurança) |
| RNF-07 | Privacidade | 100% offline, sem requisições de rede e sem telemetria. Fontes e ícones empacotados localmente. | CSP `connect-src` sem hosts externos |
| RNF-08 | Responsividade | Layout funcional de 960×600 até 4K. A grade ajusta colunas automaticamente e a sidebar recolhe sozinha abaixo de 1100 px de largura. | Teste manual redimensionando |
| RNF-09 | i18n | Nenhum texto de UI hardcoded: todos em `locales/pt-BR.json` via i18next. Datas e números formatados com `Intl` em `pt-BR`. | Lint/revisão |
| RNF-10 | Acessibilidade | Foco de teclado visível, contraste de texto ≥ AA (4.5:1), todos os controles alcançáveis por teclado, `aria-label` em botões só-ícone. | Revisão + axe no DevTools |
| RNF-11 | Plataforma | Windows 10/11 x64 (NSIS, com atalho no menu Iniciar), macOS 12+ (dmg/zip, x64 e arm64) e Linux x64 (AppImage/deb). O código não deve usar APIs exclusivas de uma plataforma sem abstração (`process.platform` isolado em pontos pontuais, documentados). Builds sem assinatura de código: SmartScreen/Gatekeeper avisam o usuário na primeira execução. | Build no CI (matriz Windows/macOS/Linux) |
| RNF-12 | Integridade | Escritas no banco usam WAL. Uma queda de energia durante a leitura perde no máximo 1 s de progresso. | Revisão |
| RNF-13 | Manutenibilidade | TypeScript `strict`, sem `any` implícito, contratos IPC tipados ponta a ponta a partir de `src/shared`. | `tsc --noEmit` no CI |

## 6. Rastreabilidade com o documento original

| Item em `general.md` | Requisito(s) |
|---|---|
| Upload e leitura de HQs | RF-01, RF-02, RF-06, RF-30 |
| Organizar em pastas (decisão de produto: fora do app) | RF-01 a RF-06, RF-64, `docs/10-decisoes.md` |
| Opção de zoom | RF-34, RF-33 |
| Trocar página por setas e mouse | RF-35, RF-36 |
| Tela cheia | RF-37 |
| Portrait com zoom | RF-33 |
| Desligar a luz | RF-38 |
| Salvar página ao sair | RF-40 |
| CBR, CBZ e ZIP com vários arquivos | RF-01, RF-02 |
| Deleção de HQs | RF-17 |
| "Continuar onde parou" | RF-11, RF-42, RF-63 |
| Lista de todas as HQs | RF-10 |
| Design moderno, clean, intuitivo | [07-ui-ux.md](07-ui-ux.md), RF-62 |
| Responsividade | RNF-08 |
| Sidebar à esquerda | RF-60 |
| Tema escuro, sem light mode | [07-ui-ux.md](07-ui-ux.md) |
| Electron (Vite/TypeScript) | [02-arquitetura.md](02-arquitetura.md) |
| Não é rede social / sem login | Seção 2 (fora do escopo), RNF-07 |

**Adições combinadas no refinamento:** PDF (RF-01/RF-02), página dupla (RF-32), busca/filtros (RF-12, RF-13), status lido (RF-14), favoritos (RF-15), duplicatas (RF-05), scan automático e manual (RF-04), renomear HQ (RF-16), fim da HQ/próximo arquivo da pasta (RF-42).

**Revisão pós-v1 (ver `docs/10-decisoes.md`):** o modelo de importação manual (RF-01–06 originais) e as coleções manuais Listas/Sagas (antigo §4.3, RF-20–26) foram substituídos por escaneamento de pastas-raiz configuradas pelo usuário — sem cópia de arquivos e sem organização dentro do app. Em seguida, a Biblioteca ganhou de volta uma visualização por pastas (RF-64, ADR-018): a estrutura de pastas do usuário passou a ser navegável dentro do app (só leitura), ao lado da lista única (RF-10..13).
