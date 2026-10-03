# Comic Reader

App desktop (Electron + React + TypeScript) para importar, ler e organizar HQs (CBZ, ZIP, CBR e PDF) localmente. Funciona offline, sem login, com tema escuro e interface em português (pt-BR). Disponível para Windows, macOS e Linux (ver [ADR-021](docs/10-decisoes.md#adr-021--multiplataforma-windowsmacoslinux-e-preparação-open-source)).

## Instalação

- **Windows:** baixe `comic-reader-<versão>-setup.exe` e execute. A instalação é por usuário (não pede administrador), cria atalhos no Menu Iniciar e na Área de Trabalho e permite escolher a pasta. Ao desinstalar, o programa **pergunta** se a biblioteca também deve ser removida.
- **macOS:** baixe `comic-reader-<versão>-<arch>.dmg` (`x64` ou `arm64`), abra e arraste o app para Aplicativos. Como o build não é assinado, o Gatekeeper vai avisar na primeira abertura — clique com o botão direito no app → "Abrir" para confirmar.
- **Linux:** baixe o `.AppImage` (torne executável com `chmod +x` e rode direto, sem instalar) ou o `.deb` (`sudo dpkg -i comic-reader-<versão>.deb`, Debian/Ubuntu).

Nenhum dos três instaladores é assinado digitalmente (ver ADR-021) — isso é uma decisão aceita para um projeto open-source sem orçamento para certificados, e os SOs vão avisar o usuário na primeira execução.

## Onde ficam os dados

- **Windows:** `%APPDATA%\Comic Reader\`
- **macOS:** `~/Library/Application Support/Comic Reader/`
- **Linux:** `~/.config/Comic Reader/`

Em cada um: banco SQLite, capas, cache de páginas e logs (o app lê as HQs onde elas já estão, sem copiá-las — ver ADR-017). Layout completo em [docs/03-modelo-de-dados.md](docs/03-modelo-de-dados.md).

Ao desinstalar, só o instalador NSIS do Windows pergunta se esses dados devem ser removidos (ADR-016). No macOS (arrastar para a Lixeira) e no Linux (remover o `.AppImage`/`.deb`) não há esse passo automático — para remover os dados manualmente, apague a pasta listada acima para o seu SO.

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
npm run dist:win     # gera dist/comic-reader-<versão>-setup.exe (rode no Windows)
npm run dist:mac      # gera dist/comic-reader-<versão>-<arch>.dmg|.zip (rode no macOS)
npm run dist:linux    # gera dist/comic-reader-<versão>.AppImage|.deb (rode no Linux)
npm run dist          # builda só para o SO atual (sem flag de plataforma)
```

Módulos nativos (`better-sqlite3`) são rebuildados pelo próprio SO onde o build roda — não é possível gerar o instalador de uma plataforma a partir de outra numa máquina local. O [CI](.github/workflows/build.yml) builda e testa as três plataformas a cada push/PR, e publica os instaladores como artifacts de uma Release.

O desinstalador do Windows é customizado em [build/installer.nsh](build/installer.nsh) (sem equivalente em macOS/Linux — ver "Onde ficam os dados" acima).

## Documentação

A especificação em [docs/](docs/README.md) é a fonte da verdade; as regras de arquitetura estão em [CLAUDE.md](CLAUDE.md). Histórico em [CHANGELOG.md](CHANGELOG.md).

## Licença

[MIT](LICENSE)
