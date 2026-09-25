# Comic Reader

App desktop (Electron + React + TypeScript) para importar, ler e organizar HQs (CBZ, ZIP, CBR e PDF) localmente. Funciona offline, sem login, com tema escuro e interface em português (pt-BR). A v1 tem como alvo o Windows 10/11 x64.

## Instalação

Baixe `comic-reader-<versão>-setup.exe` e execute. A instalação é por usuário (não pede administrador), cria atalhos no Menu Iniciar e na Área de Trabalho e permite escolher a pasta. Ao desinstalar, o programa **pergunta** se a biblioteca também deve ser removida.

## Onde ficam os dados

Em `%APPDATA%\Comic Reader\`: banco SQLite, cópias das HQs importadas (`library/`), capas, cache de páginas e logs. Layout completo em [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md).

## Desenvolvimento

Requer Node 22+ (testado com 24).

```bash
npm install
npm run dev         # app em desenvolvimento, com HMR
npm run typecheck
npm run lint
npm test            # Vitest (roda dentro do Electron, por causa do better-sqlite3)
npm run test:e2e    # Playwright + Electron
E2E_MEMORY=1 npm run test:e2e   # inclui o teste de memória (pesado)
```

Em Linux/WSL o app desliga a aceleração de GPU automaticamente. No VS Code, se o Electron não abrir, limpe `ELECTRON_RUN_AS_NODE` do ambiente.

## Build do instalador

```bash
npm run dist        # gera dist/comic-reader-<versão>-setup.exe (rode no Windows)
```

O desinstalador é customizado em [build/installer.nsh](build/installer.nsh).

## Documentação

A especificação em [docs/](docs/README.md) é a fonte da verdade; as regras de arquitetura estão em [CLAUDE.md](CLAUDE.md). Histórico em [CHANGELOG.md](CHANGELOG.md).
