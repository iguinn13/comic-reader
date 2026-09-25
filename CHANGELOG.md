# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.0.0] — não lançada

Primeira versão (alvo: Windows 10/11 x64).

### Adicionado

- Importação de CBZ, ZIP, CBR e PDF por seleção de arquivos ou arrastar e soltar, com painel de progresso e cancelamento (RF-01..).
- Biblioteca com busca, filtros, ordenação, favoritos, status de leitura e grade virtualizada (testada com 5.000 HQs).
- Leitor com modos página única, página dupla e vertical contínuo, zoom, tela cheia e atalhos de teclado; PDFs renderizados via pdf.js.
- Progresso de leitura salvo automaticamente e retomado ao reabrir.
- Coleções e sagas ordenáveis (arrastar), com sugestão da próxima HQ no fim da leitura e "Sagas em andamento" na Home.
- Tela de configurações: limite do cache de páginas, uso de disco, pasta de dados.
- Instalador NSIS por usuário; o desinstalador pergunta se os dados devem ser removidos.

### Testes

- Suíte unitária (Vitest) e E2E (Playwright + Electron): fluxo importar/ler, modos, sagas, exclusão, robustez contra encerramento forçado e memória do modo vertical.
