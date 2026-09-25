# Comic Reader — Documentação (SDD)

Esta pasta contém a especificação do **Comic Reader**, um aplicativo desktop (Electron) para ler HQs localmente a partir de pastas escolhidas pelo usuário, sem login e sem rede.

A documentação segue a abordagem **Spec-Driven Development (SDD)**: a especificação vem antes do código e é a fonte da verdade. Toda funcionalidade implementada deve apontar para um requisito (`RF-xx` / `RNF-xx`). Qualquer mudança de comportamento começa por aqui.

## Índice

| # | Documento | Para que serve |
|---|---|---|
| — | [general.md](general.md) | Descrição original do projeto (entrada do usuário, mantida como referência) |
| 01 | [01-requisitos.md](01-requisitos.md) | Escopo, requisitos funcionais e não funcionais, critérios de aceite, rastreabilidade |
| 02 | [02-arquitetura.md](02-arquitetura.md) | Processos Electron, camadas, estrutura de pastas, protocolo `comic://`, segurança |
| 03 | [03-modelo-de-dados.md](03-modelo-de-dados.md) | Schema SQLite, regras de integridade, layout de arquivos em disco |
| 04 | [04-contratos-ipc.md](04-contratos-ipc.md) | API tipada exposta ao renderer (`window.api`), eventos e erros |
| 05 | [05-importacao.md](05-importacao.md) | Scan de pastas-raiz e indexação de CBZ/CBR/ZIP/PDF |
| 06 | [06-leitor.md](06-leitor.md) | Especificação do leitor: modos, zoom, navegação, atalhos, progresso |
| 07 | [07-ui-ux.md](07-ui-ux.md) | Design system escuro, telas, componentes, estados |
| 08 | [08-plano-de-implementacao.md](08-plano-de-implementacao.md) | Milestones e tarefas ordenadas, com definição de pronto |
| 09 | [09-testes-e-qualidade.md](09-testes-e-qualidade.md) | Estratégia de testes, fixtures, lint, convenções |
| 10 | [10-decisoes.md](10-decisoes.md) | Registro de decisões de arquitetura (ADRs) |

## Ordem de leitura sugerida

1. **01-requisitos**: o *quê* e o *porquê*.
2. **07-ui-ux**: como o usuário enxerga o app.
3. **02-arquitetura → 03 → 04**: o *como*, de fora para dentro.
4. **05 e 06**: as duas áreas de maior complexidade técnica.
5. **08**: por onde começar a implementar.

## Como manter

- **Requisito novo ou alterado** → edite `01-requisitos.md` primeiro (novo ID, nunca reutilize um ID removido; marque como *Removido*).
- **Decisão técnica relevante** (nova dependência, mudança de estratégia) → adicione um ADR em `10-decisoes.md`.
- **Mudança de contrato IPC ou schema** → atualize `03`/`04` no mesmo commit do código.
- As seções marcadas com **(v2)** estão fora do escopo da primeira versão, mas o design não deve impedi-las.

## Glossário

| Termo | Significado |
|---|---|
| **HQ** | Uma revista/edição indexada: um arquivo CBZ, CBR, ZIP ou PDF. Entidade `comic` no código. |
| **Biblioteca** | O conjunto de todas as HQs indexadas, lidas in-place a partir das pastas-raiz configuradas pelo usuário (nunca copiadas para dentro do app). |
| **Pasta-raiz** | Pasta escolhida pelo usuário nas Configurações, escaneada recursivamente em busca de HQs. Entidade `library_folders`. |
| **Progresso** | Página atual de uma HQ + status (não lida / em andamento / lida). |
| **Modo de leitura** | Forma de exibir as páginas: *página única*, *página dupla* ou *vertical contínuo*. |
| **Vertical contínuo** | Modo estilo webtoon ("portrait com zoom"): páginas empilhadas verticalmente, largura da coluna ajustável. |
| **Spread** | Par de páginas exibidas lado a lado no modo página dupla. |
| **Cache de páginas** | Imagens extraídas dos arquivos compactados, guardadas em disco para leitura rápida. |
| **Main / Renderer / Preload** | Processos do Electron: Node.js (main), UI React (renderer) e a ponte segura entre eles (preload). |
