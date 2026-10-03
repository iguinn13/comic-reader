# Comic Reader

App desktop (Electron + electron-vite + React + TypeScript) para importar, ler e organizar HQs (CBZ/CBR/PDF/ZIP) localmente. É offline, sem login e só tem tema escuro. A UI está em pt-BR via i18next, e o app tem como alvo Windows, macOS e Linux (ver ADR-021 em `docs/10-decisoes.md`).

## A especificação é a fonte da verdade

Antes de implementar qualquer coisa, leia a parte relevante de [docs/](docs/README.md):

- Requisitos e critérios de aceite: `docs/01-requisitos.md` (IDs `RF-xx` / `RNF-xx`)
- Arquitetura e segurança: `docs/02-arquitetura.md`
- Schema e layout em disco: `docs/03-modelo-de-dados.md`
- Contrato `window.api`: `docs/04-contratos-ipc.md`
- Importação: `docs/05-importacao.md` · Leitor: `docs/06-leitor.md` · UI: `docs/07-ui-ux.md`
- Ordem de trabalho: `docs/08-plano-de-implementacao.md`
- Testes e convenções: `docs/09-testes-e-qualidade.md` · Decisões: `docs/10-decisoes.md`

Regras:
- Toda funcionalidade aponta para um RF. Se o comportamento pedido não está na spec ou contradiz a spec, atualize a spec (ou pergunte) **antes** do código.
- Mudou schema ou IPC? Atualize `03`/`04` no mesmo commit. Nova dependência ou mudança de estratégia? Adicione um ADR em `10`.

## Regras de arquitetura

- O main detém toda a regra de negócio, o disco e o banco. O renderer só apresenta e conhece apenas **IDs**, nunca caminhos.
- Imagens nunca trafegam por IPC: use URLs `comic://` ([02 §5](docs/02-arquitetura.md#5-protocolo-comic)).
- Todo handler IPC valida o input com zod e retorna `Result<T>`.
- `src/shared` não importa Node nem DOM. `src/renderer` não importa `electron` nem `node:*`.
- Textos de UI só em `src/renderer/src/i18n/locales/pt-BR.json`.
- Código e identificadores em inglês. Comentários e docs em pt-BR.

## Comandos

Os comandos passam a existir depois do M0. Veja a lista completa em `docs/09-testes-e-qualidade.md` §4.

```bash
npm run dev         # app em desenvolvimento
npm run typecheck   # tsc nos 3 projetos
npm run lint
npm test            # Vitest
npm run test:e2e    # Playwright + Electron
npm run dist        # instalador NSIS (Windows)
```
