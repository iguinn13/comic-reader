import { dialog } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import {
  zCollectionCoverInput,
  zCollectionCreateInput,
  zCollectionId,
  zCollectionType,
  zCollectionUpdateInput,
  zComicIdList,
} from '@shared/schemas'
import type { CollectionService } from '../services/collection-service'
import { handle } from './handle'

/**
 * `pickCoverImage` usa `dialog.showOpenDialog` diretamente, como
 * `importer.ts` faz pra `pickFiles` — adaptador de UI do SO, não regra de
 * negócio (docs/02-arquitetura.md §3).
 */
export function registerCollectionsIpc(service: CollectionService): void {
  handle(
    CH.collections.list,
    z.tuple([zCollectionType, z.enum(['name', 'updatedAt'])]),
    ([type, sort]) => service.list(type, sort),
  )
  handle(CH.collections.get, z.tuple([zCollectionId]), ([id]) => service.get(id))
  handle(CH.collections.create, z.tuple([zCollectionCreateInput]), ([input]) =>
    service.create(input),
  )
  handle(CH.collections.update, z.tuple([zCollectionId, zCollectionUpdateInput]), ([id, patch]) =>
    service.update(id, patch),
  )
  handle(CH.collections.delete, z.tuple([zCollectionId]), ([id]) => service.delete(id))
  handle(CH.collections.addItems, z.tuple([zCollectionId, zComicIdList]), ([id, comicIds]) =>
    service.addItems(id, comicIds),
  )
  handle(CH.collections.removeItems, z.tuple([zCollectionId, zComicIdList]), ([id, comicIds]) =>
    service.removeItems(id, comicIds),
  )
  handle(CH.collections.reorder, z.tuple([zCollectionId, zComicIdList]), ([id, orderedComicIds]) =>
    service.reorder(id, orderedComicIds),
  )
  handle(CH.collections.setCover, z.tuple([zCollectionId, zCollectionCoverInput]), ([id, cover]) =>
    service.setCover(id, cover),
  )
  handle(CH.collections.membership, z.tuple([zComicIdList]), ([comicIds]) =>
    service.membership(comicIds),
  )
  handle(CH.collections.nextToRead, z.tuple([zCollectionId]), ([sagaId]) =>
    service.nextToRead(sagaId),
  )

  handle(CH.collections.pickCoverImage, z.tuple([]), async () => {
    const result = await dialog.showOpenDialog({
      title: 'Escolher imagem de capa',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
