import { existsSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { extname, join } from 'path'
import type { Db } from '../db/client'
import { listComicIds } from '../db/repositories/comics'
import { logger } from '../utils/logger'
import type { AppPaths } from '../utils/paths'

/**
 * Rotinas de boot (docs/02-arquitetura.md §7 passo 3, RNF-05): remove capas
 * órfãs em `covers/comics/` (cujo id não existe mais em `comics`) — só podem
 * existir por uma queda do app no meio de uma exclusão (o rollback normal já
 * limpa isso). Arquivos ausentes/adicionados nas pastas do usuário são
 * responsabilidade do `LibraryScanService`, não deste serviço.
 */
export class MaintenanceService {
  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
  ) {}

  async run(): Promise<void> {
    await this.removeOrphanFiles(this.paths.coversComicsDir)
  }

  private async removeOrphanFiles(dir: string): Promise<void> {
    if (!existsSync(dir)) return

    const validIds = new Set(listComicIds(this.db))
    const entries = await readdir(dir)

    await Promise.all(
      entries.map(async (entry) => {
        const id = entry.slice(0, entry.length - extname(entry).length)
        if (validIds.has(id)) return
        try {
          await rm(join(dir, entry), { force: true })
          logger.info(`[maintenance] arquivo órfão removido: ${join(dir, entry)}`)
        } catch (error) {
          logger.error(`[maintenance] falha ao remover órfão ${entry}:`, error)
        }
      }),
    )
  }
}
