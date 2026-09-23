import type { ImportService } from '../services/import-service'
import type { SettingsService } from '../services/settings-service'
import { registerImporterIpc } from './importer'
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
 * Os demais domínios (library, collections, reader, app) chegam a partir de
 * M3+, quando os serviços correspondentes existirem.
 */
export interface AppServices {
  settingsService: SettingsService
  importService: ImportService
}

export function registerAllIpc(services: AppServices): void {
  registerSettingsIpc(services.settingsService)
  registerImporterIpc(services.importService)
}
