import type { Db } from '../db/client'
import { getLibraryTotals } from '../db/repositories/comics'
import type { PageCacheService } from './page-cache-service'

/** Estatísticas de armazenamento e limpeza de cache (RF-51, RF-52) para a tela Configurações. */
export class StorageService {
  constructor(
    private readonly db: Db,
    private readonly pageCache: PageCacheService,
  ) {}

  async stats(): Promise<{ comicCount: number; libraryBytes: number; cacheBytes: number }> {
    return { ...getLibraryTotals(this.db), cacheBytes: await this.pageCache.usageBytes() }
  }

  async clearCache(): Promise<{ freedBytes: number }> {
    return { freedBytes: await this.pageCache.clear() }
  }
}
