import { z } from 'zod'
import { CH } from '@shared/channels'
import { zComicId, zComicIdList, zLibraryQuery, zReadStatus, zTitle } from '@shared/schemas'
import type { LibraryService } from '../services/library-service'
import { handle } from './handle'

export function registerLibraryIpc(service: LibraryService): void {
  handle(CH.library.home, z.tuple([]), () => service.home())
  handle(CH.library.list, z.tuple([zLibraryQuery]), ([query]) => service.list(query))
  handle(CH.library.get, z.tuple([zComicId]), ([id]) => service.get(id))
  handle(CH.library.rename, z.tuple([zComicId, zTitle]), ([id, title]) => service.rename(id, title))
  handle(CH.library.setFavorite, z.tuple([zComicIdList, z.boolean()]), ([ids, value]) =>
    service.setFavorite(ids, value),
  )
  handle(CH.library.setReadStatus, z.tuple([zComicIdList, zReadStatus]), ([ids, status]) =>
    service.setReadStatus(ids, status),
  )
  handle(CH.library.delete, z.tuple([zComicIdList]), ([ids]) => service.delete(ids))
}
