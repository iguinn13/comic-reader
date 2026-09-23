import type { SettingsService } from '../services/settings-service'
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
 * Os demais domínios (library, importer, collections, reader, app) chegam
 * a partir de M2, quando os serviços correspondentes existirem.
 */
export interface AppServices {
  settingsService: SettingsService
}

export function registerAllIpc(services: AppServices): void {
  registerSettingsIpc(services.settingsService)
}
