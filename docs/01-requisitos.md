# 01 — Requisitos

## 1. Visão

Um leitor de HQs desktop, **offline e local**, pensado para o fã que tem uma coleção de arquivos CBZ/CBR/PDF espalhados pelo computador. O app centraliza esses arquivos numa biblioteca, oferece uma leitura confortável e permite organizá-los em **listas** e **sagas**.

**Princípios**

1. **Leitura primeiro:** abrir e ler uma HQ deve ser rápido e sem atrito, e o app lembra onde você parou.
2. **Clean e escuro:** visual minimalista e escuro, com a capa das HQs como protagonista.
3. **Local e privado:** sem conta, sem servidor, sem telemetria.

## 2. Escopo

### Dentro do escopo (v1)
- Importar HQs nos formatos CBZ, CBR, PDF e ZIP (contendo várias HQs ou apenas imagens).
- Ler em três modos: página única, página dupla e vertical contínuo, com zoom, tela cheia e modo foco.
- Salvar o progresso automaticamente e oferecer a seção "Continuar lendo".
- Organizar em listas e sagas (criar, editar, excluir, capa, ordenação da saga).
- Buscar, filtrar e ordenar a biblioteca, com status lido/não lido e favoritos.
- Interface em pt-BR, estruturada para i18n.
- Empacotamento para Windows 10/11 x64.

### Fora do escopo
- Rede social, comentários, compartilhamento.
- Login, contas, sincronização em nuvem.
- Light mode.
- Leitura direita→esquerda (mangá). **(v2)**
- Formatos CB7/7z, CBT, EPUB, pasta de imagens. **(v2)**
- Leitura de metadados `ComicInfo.xml`. **(v2)**
- Download/scraping de HQs ou de metadados da internet.
- Edição das imagens das HQs.
- Builds para Linux/macOS. **(v2)** A arquitetura não deve impedi-las.
- Auto-update. **(v2)**

## 3. Personas

- **Leitor colecionador:** tem centenas ou milhares de arquivos e quer organizá-los por saga/arco e retomar a leitura sem procurar a página.
- **Leitor casual:** importa algumas HQs e só quer abrir e ler com conforto, muitas vezes em tela cheia à noite.

## 4. Requisitos funcionais

Convenção: cada requisito tem um ID estável `RF-xx` e critérios de aceite no formato *Dado / Quando / Então*. Prioridade: **P1** (obrigatório v1) e **P2** (desejável v1, pode ir para o fim do cronograma).

### 4.1 Importação

**RF-01 — Importar por diálogo de arquivos (P1)**
O usuário importa uma ou mais HQs pelo botão "Importar" da sidebar, que abre o diálogo nativo com multisseleção e filtro `.cbz, .cbr, .zip, .pdf`.
- Dado que o usuário selecionou 3 arquivos válidos, quando confirma o diálogo, então os 3 entram na fila de importação e aparecem na biblioteca ao concluir.
- Dado que o usuário cancela o diálogo, então nada acontece.

**RF-02 — Importar arrastando arquivos (P1)**
Arrastar arquivos sobre a janela mostra um overlay "Solte para importar". Soltar inicia a importação.
- Dado que o usuário arrasta arquivos com extensões não suportadas junto com suportadas, quando solta, então só as suportadas entram na fila e as demais aparecem no resumo como "formato não suportado".

**RF-03 — ZIP com várias HQs (P1)**
Um `.zip` pode conter (a) várias HQs (`.cbz`, `.cbr`, `.pdf`), inclusive em subpastas, ou (b) apenas imagens.
- Dado um ZIP com 5 CBZ e 2 CBR, quando importado, então 7 HQs são criadas, com títulos derivados dos nomes dos arquivos internos.
- Dado um ZIP contendo apenas imagens, quando importado, então é tratado como uma única HQ (equivalente a CBZ).
- Dado um ZIP com HQs e imagens soltas, então as HQs internas são importadas e as imagens soltas são ignoradas, com aviso no resumo.
- ZIPs aninhados em mais de 1 nível (ZIP dentro de ZIP dentro de ZIP) não são expandidos e aparecem no resumo como "não suportado".

**RF-04 — Fila de importação com progresso (P1)**
A importação roda em segundo plano, com um painel (canto inferior direito) que mostra cada item com estado (aguardando, processando, concluído, duplicado, erro) e progresso geral.
- O usuário pode continuar navegando e lendo durante a importação.
- O usuário pode **cancelar** a fila. Os itens já concluídos permanecem, e o item em andamento é revertido sem deixar lixo em disco.
- Ao final, é exibido um resumo: *N importadas, N duplicadas ignoradas, N com erro* (com motivo por arquivo).

**RF-05 — Detecção de duplicatas (P1)**
Uma HQ é duplicada se o hash SHA-1 do arquivo já existe na biblioteca.
- Dado um arquivo duplicado, quando for processado, então a fila pausa esse item e pergunta: **Pular** / **Importar mesmo assim**, com a opção "Aplicar a todos os duplicados desta importação".

**RF-06 — Armazenamento na biblioteca (P1)**
Toda HQ importada é **copiada** para a pasta gerenciada da biblioteca. O original nunca é alterado ou movido.
- O título inicial é o nome do arquivo sem extensão, com `_` e `.` repetidos trocados por espaço e espaços aparados.
- Uma capa (miniatura da primeira página) é gerada na importação.
- Dado que o original é apagado depois da importação, então a HQ continua legível no app.

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
- O usuário pode marcar manualmente como **lida** ou **não lida** (uma ou várias). "Não lida" zera o progresso.

**RF-15 — Favoritos (P1)**
O usuário pode favoritar/desfavoritar uma HQ pelo card, menu de contexto ou leitor. A sidebar tem a entrada "Favoritas", com a grade das HQs favoritas (mesmos controles da Biblioteca).

**RF-16 — Renomear HQ (P1)**
O usuário pode editar o título de exibição de uma HQ. O arquivo em disco não muda. O título não pode ser vazio (máx. 200 caracteres).

**RF-17 — Excluir HQ (P1)**
O usuário pode excluir uma ou várias HQs, com diálogo de confirmação ("Esta ação remove o arquivo da biblioteca do app. O arquivo original que você importou não é afetado.").
- A exclusão remove o registro, o arquivo da biblioteca, a capa, o cache de páginas e a participação em listas/sagas.
- A capa automática das coleções afetadas é recalculada.

**RF-18 — Seleção múltipla (P1)**
Nas grades de HQs é possível selecionar várias (checkbox ao passar o mouse, `Ctrl+clique`, `Shift+clique` para intervalo, `Ctrl+A`). Com seleção ativa, uma barra de ações mostra: *Adicionar a lista/saga*, *Marcar como lida*, *Marcar como não lida*, *Favoritar*, *Excluir*, *Cancelar seleção* (`Esc`).

**RF-19 — Menu de contexto do card (P1)**
Clique direito (ou botão "⋯" no hover) no card de HQ: *Ler*, *Marcar como lida/não lida*, *Favoritar/Desfavoritar*, *Adicionar a…* (submenu com listas, sagas e "Nova lista…/Nova saga…"), *Renomear*, *Excluir*.

### 4.3 Listas e sagas (coleções)

**RF-20 — Criar coleção (P1)**
O usuário cria uma lista ou saga informando **tipo**, **nome** (obrigatório, único por tipo sem diferenciar maiúsculas, máx. 100 caracteres), **descrição** (opcional, máx. 500) e **capa** (opcional, ver RF-25).
- A criação pode partir das telas "Listas"/"Sagas" ou do submenu "Adicionar a… → Nova…". Nesse caso as HQs selecionadas já entram na coleção nova.

**RF-21 — Editar coleção (P1)**
É possível alterar nome, descrição, capa e **tipo** (lista ↔ saga). Converter lista em saga preserva a ordem atual dos itens.

**RF-22 — Excluir coleção (P1)**
Excluir uma coleção exige confirmação e **nunca** exclui as HQs.

**RF-23 — Adicionar/remover HQs da coleção (P1)**
- Adicionar pelo menu "Adicionar a…" (card, seleção múltipla, leitor) ou pelo botão "Adicionar HQs" dentro da coleção, que abre um seletor com busca e multisseleção.
- Uma HQ pode estar em várias coleções, mas no máximo uma vez na mesma coleção. Adicionar de novo é ignorado silenciosamente.
- Novos itens entram **no fim** da coleção.
- Remover da coleção não exclui a HQ.

**RF-24 — Saga ordenada (P1)**
- Dentro de uma saga, os itens aparecem numerados (1, 2, 3…) na ordem definida, e o usuário reordena arrastando (drag & drop) ou com "Mover para cima/baixo/início/fim" no menu.
- O cabeçalho da saga mostra o progresso **"x de y lidas"** com uma barra.
- O botão **"Continuar saga"** abre a primeira HQ da ordem que não esteja lida (retomando na página salva). Se todas estiverem lidas, o botão vira "Ler novamente", que abre a primeira.
- Numa lista, os itens seguem a ordem de adição, e a tela oferece as mesmas ordenações da Biblioteca (sem drag & drop).

**RF-25 — Capa de coleção (P1)**
Três modos:
1. **Automática** (padrão): capa da primeira HQ da coleção (pela ordem da saga ou pela ordem de adição na lista). Coleção vazia mostra um placeholder com a inicial do nome.
2. **Imagem própria:** o usuário escolhe um arquivo JPG/PNG/WebP, que é copiado e redimensionado pelo app.
3. **Capa de uma HQ da coleção:** o usuário escolhe uma das HQs da coleção.
- Se a HQ usada no modo 3 for removida da coleção/excluída, a capa volta para Automática.

**RF-26 — Telas de coleções (P1)**
As entradas "Sagas" e "Listas" da sidebar exibem grades de coleções com capa, nome, contagem de HQs e, nas sagas, a barra de progresso. Há ordenação por nome e por atualização recente.

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

**RF-38 — Modo foco, "desligar a luz" (P1)**
Alternar com `L` ou botão: esconde sidebar e barras, fundo preto absoluto (`#000`). Mover o mouse mostra os controles por 2,5 s. O estado do modo foco persiste globalmente.

**RF-39 — Indicador e salto de página (P1)**
Barra inferior com slider de progresso, "página X de Y" e campo "Ir para página". `Home`/`End` vão para a primeira/última.

**RF-40 — Salvamento automático do progresso (P1)**
A página atual é persistida a cada mudança e garantidamente ao fechar o leitor, ao fechar o app ou em crash do renderer. Reabrir o app e a HQ volta à mesma página.

**RF-41 — Preferências por HQ (P1)**
O modo de leitura, o ajuste/zoom e a largura vertical escolhidos numa HQ ficam lembrados para ela. HQs nunca abertas usam os padrões globais (RF-50).

**RF-42 — Fim da HQ (P1)**
- Ao exibir a última página (ou último spread; no vertical, ao rolar até o fim), a HQ é marcada como **lida**.
- Tentar avançar além da última página exibe o painel de fim: "Você terminou *Título*", com **"Próxima da saga: *Título*"** (se a HQ pertence a uma saga e não é a última), "Voltar à biblioteca" e "Continuar lendo aqui".
- Se a HQ foi aberta a partir de uma saga, a sugestão usa essa saga. Se ela pertence a várias sagas, todas são listadas.

**RF-43 — Pré-carregamento (P1)**
Páginas vizinhas são pré-carregadas para que a troca de página seja instantânea (ver RNF-01).

**RF-44 — Ações da HQ dentro do leitor (P2)**
Favoritar e "Adicionar a…" também estão acessíveis na barra superior do leitor.

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
Menu lateral esquerdo fixo com: **Início**, **Biblioteca**, **Favoritas**, **Sagas**, **Listas**, botão primário **Importar** e **Configurações** (rodapé). Pode ser recolhida para ícones (botão ou `Ctrl+B`) e o estado persiste. O item ativo fica destacado.

**RF-61 — Estado da janela (P1)**
Tamanho, posição e estado maximizado da janela são restaurados ao reabrir. A janela mínima é de 960×600.

**RF-62 — Estados vazios e de erro (P1)**
Toda tela tem um estado vazio com orientação (ex.: biblioteca vazia → "Arraste suas HQs aqui ou clique em Importar"). Uma HQ cujo arquivo sumiu ou corrompeu mostra um erro no leitor com a opção "Excluir da biblioteca".

**RF-63 — Tela Início (P1)**
Contém: "Continuar lendo" (RF-11), "Sagas em andamento" (sagas com pelo menos 1 lida e pelo menos 1 não lida, até 10) e "Adicionadas recentemente" (últimas 20 HQs).

## 5. Requisitos não funcionais

| ID | Categoria | Requisito | Como medir |
|---|---|---|---|
| RNF-01 | Desempenho | Troca de página < 100 ms com pré-carregamento. Primeira página de um CBZ de até 150 MB visível em < 2 s na primeira abertura, e < 500 ms quando já está em cache. | Log de tempos em dev + teste manual com fixture grande |
| RNF-02 | Escala | Biblioteca com 5.000 HQs: grade rolando a 60 fps (virtualizada), busca/filtro respondendo em < 200 ms e boot até a tela Início em < 3 s. | Script de seed com 5.000 registros |
| RNF-03 | Memória | Renderer < 600 MB lendo uma HQ de 300 páginas no modo vertical (virtualização: só páginas próximas montadas no DOM). | Gerenciador de tarefas / `process.getProcessMemoryInfo` |
| RNF-04 | Fluidez | Scroll do modo vertical e das grades a 60 fps em hardware médio (i5, 8 GB, SSD). | DevTools Performance |
| RNF-05 | Robustez | Uma falha num arquivo não interrompe a fila. Operações de banco que tocam várias tabelas são transacionais. O boot limpa arquivos órfãos (em disco sem registro, e temporários de importação). | Testes unitários + teste de cancelamento |
| RNF-06 | Segurança | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP estrita, sem `remote`, todo input de IPC validado com zod e caminhos de arquivo nunca montados a partir de strings do renderer (só IDs). | Checklist em [02-arquitetura.md](02-arquitetura.md#6-segurança) |
| RNF-07 | Privacidade | 100% offline, sem requisições de rede e sem telemetria. Fontes e ícones empacotados localmente. | CSP `connect-src` sem hosts externos |
| RNF-08 | Responsividade | Layout funcional de 960×600 até 4K. A grade ajusta colunas automaticamente e a sidebar recolhe sozinha abaixo de 1100 px de largura. | Teste manual redimensionando |
| RNF-09 | i18n | Nenhum texto de UI hardcoded: todos em `locales/pt-BR.json` via i18next. Datas e números formatados com `Intl` em `pt-BR`. | Lint/revisão |
| RNF-10 | Acessibilidade | Foco de teclado visível, contraste de texto ≥ AA (4.5:1), todos os controles alcançáveis por teclado, `aria-label` em botões só-ícone. | Revisão + axe no DevTools |
| RNF-11 | Plataforma | Windows 10/11 x64, com instalador NSIS e atalho no menu Iniciar. O código não deve usar APIs exclusivas de Windows sem abstração. | Build no CI/local |
| RNF-12 | Integridade | Escritas no banco usam WAL. Uma queda de energia durante a leitura perde no máximo 1 s de progresso. | Revisão |
| RNF-13 | Manutenibilidade | TypeScript `strict`, sem `any` implícito, contratos IPC tipados ponta a ponta a partir de `src/shared`. | `tsc --noEmit` no CI |

## 6. Rastreabilidade com o documento original

| Item em `general.md` | Requisito(s) |
|---|---|
| Upload e leitura de HQs | RF-01, RF-02, RF-06, RF-30 |
| Organizar em listas, sagas | RF-20 a RF-26 |
| Opção de zoom | RF-34, RF-33 |
| Trocar página por setas e mouse | RF-35, RF-36 |
| Tela cheia | RF-37 |
| Portrait com zoom | RF-33 |
| Desligar a luz | RF-38 |
| Salvar página ao sair | RF-40 |
| CBR, CBZ e ZIP com vários arquivos | RF-01, RF-03 |
| Listas/sagas com nome e capa | RF-20, RF-25 |
| Deleção de HQs e listas/sagas | RF-17, RF-22 |
| Edição de listas/sagas | RF-21, RF-23, RF-24 |
| "Continuar onde parou" | RF-11, RF-63 |
| Lista de todas as HQs | RF-10 |
| Design moderno, clean, intuitivo | [07-ui-ux.md](07-ui-ux.md), RF-62 |
| Responsividade | RNF-08 |
| Sidebar à esquerda | RF-60 |
| Tema escuro, sem light mode | [07-ui-ux.md](07-ui-ux.md) |
| Electron (Vite/TypeScript) | [02-arquitetura.md](02-arquitetura.md) |
| Não é rede social / sem login | Seção 2 (fora do escopo), RNF-07 |

**Adições combinadas no refinamento:** PDF (RF-01/RF-03), página dupla (RF-32), busca/filtros (RF-12, RF-13), status lido (RF-14), favoritos (RF-15), duplicatas (RF-05), drag & drop (RF-02), fila com cancelamento (RF-04), renomear HQ (RF-16), fim da HQ/próxima da saga (RF-42).
