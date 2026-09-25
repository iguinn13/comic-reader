import type { CollectionService } from '../services/collection-service'
import type { ImportService } from '../services/import-service'
import type { LibraryService } from '../services/library-service'
import type { ReaderService } from '../services/reader-service'
import type { SettingsService } from '../services/settings-service'
import { registerCollectionsIpc } from './collections'
import { registerImporterIpc } from './importer'
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
  settingsService: SettingsService
  importService: ImportService
  libraryService: LibraryService
  readerService: ReaderService
  collectionService: CollectionService
}

export function registerAllIpc(services: AppServices): void {
  registerSettingsIpc(services.settingsService)
  registerImporterIpc(services.importService)
  registerLibraryIpc(services.libraryService)
  registerReaderIpc(services.readerService)
  registerCollectionsIpc(services.collectionService)
}
