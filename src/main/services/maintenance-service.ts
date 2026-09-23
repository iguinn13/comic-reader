import { existsSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { extname, join } from 'path'
import type { Db } from '../db/client'
import { listComicIds } from '../db/repositories/comics'
import { logger } from '../utils/logger'
import type { AppPaths } from '../utils/paths'

/**
 * Rotinas de boot (docs/02-arquitetura.md §7 passo 3, RNF-05):
 * - `cache/tmp/` é sempre seguro de apagar (área de trabalho da importação,
 *   docs/03-modelo-de-dados.md §3).
 * - Arquivos órfãos em `library/` e `covers/comics/` (cujo id não existe mais
 *   em `comics`) são removidos — eles só podem existir por uma queda do app
 *   no meio de uma importação ou exclusão (o rollback normal já limpa isso).
 *
 * As HQs cujo arquivo sumiu do disco **não** são apagadas do banco (o leitor
 * mostra erro, RF-62) — isso é responsabilidade do `LibraryService`/reader,
 * fora do escopo deste serviço.
 */
export class MaintenanceService {
  constructor(
    private readonly db: Db,
    private readonly paths: AppPaths,
  ) {}

  async run(): Promise<void> {
    await this.clearTmp()
    await this.removeOrphanFiles(this.paths.libraryDir)
    await this.removeOrphanFiles(this.paths.coversComicsDir)
  }

  private async clearTmp(): Promise<void> {
    if (!existsSync(this.paths.cacheTmpDir)) return
    const entries = await readdir(this.paths.cacheTmpDir)
    await Promise.all(
      entries.map((entry) =>
        rm(join(this.paths.cacheTmpDir, entry), { recursive: true, force: true }).catch(
          (error: unknown) => {
            logger.error(`[maintenance] falha ao limpar cache/tmp/${entry}:`, error)
          },
        ),
      ),
    )
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
