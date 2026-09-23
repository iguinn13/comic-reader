/**
 * Ponto único de registro de todos os handlers IPC do app, chamado em
 * `main/index.ts` durante o boot (depois que o banco e os serviços existirem).
 *
 * Padrão esperado a partir daqui (docs/02-arquitetura.md §4, docs/04 §5): cada
 * domínio ganha um arquivo em `src/main/ipc/<dominio>.ts` que exporta uma
 * função `registerXxxIpc(service)`, usando o helper `handle()` de
 * `src/main/ipc/handle.ts` para cada canal do domínio. Essa função é
 * importada e chamada aqui, por exemplo:
 *
 *   import { registerLibraryIpc } from './library'
 *   ...
 *   registerLibraryIpc(libraryService)
 *
 * Nenhum serviço existe ainda neste milestone (chegam a partir de M1.4), então
 * por enquanto não há nada para registrar.
 */
export function registerAllIpc(): void {
  // Nenhum domínio registrado ainda — ver comentário acima.
}
