import type { Db } from '../db/client'
import type { LibraryScanService } from '../services/library-scan-service'
import type { LibraryService } from '../services/library-service'
import type { ReaderService } from '../services/reader-service'
import type { SettingsService } from '../services/settings-service'
import { registerLibraryFoldersIpc } from './library-folders'
import { registerLibraryIpc } from './library'
import { registerReaderIpc } from './reader'
import { registerSettingsIpc } from './settings'

/**
 * Ponto único de registro de todos os handlers IPC do app, chamado em
 * `main/index.ts` durante o boot, depois que o banco e os serviços existem.
 *
 * Padrão esperado a partir daqui (docs/02-arquitetura.md §4, docs/04 §5): cada
 * domínio ganha um arquivo em `src/main/ipc/<dominio>.ts` que exporta uma
 * função `registerXxxIpc(service)`, usando o helper `handle()` de
 * `src/main/ipc/handle.ts` para cada canal do domínio. Essa função é
 * importada e chamada aqui.
 *
 * `app` chega com M6, quando o serviço correspondente existir.
 */
export interface AppServices {
  db: Db
  settingsService: SettingsService
  libraryService: LibraryService
  libraryScanService: LibraryScanService
  readerService: ReaderService
}

export function registerAllIpc(services: AppServices): void {
  registerSettingsIpc(services.settingsService)
  registerLibraryIpc(services.libraryService, services.libraryScanService)
  registerLibraryFoldersIpc(services.db, services.libraryScanService)
  registerReaderIpc(services.readerService)
}
