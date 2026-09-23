import { z } from 'zod'
import {
  CACHE_MAX_BYTES,
  CACHE_MIN_BYTES,
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from './constants'

/**
 * Todo input de IPC passa por um destes schemas no handler do main (RNF-06,
 * docs/04-contratos-ipc.md). Os schemas descrevem só o formato do dado — a
 * regra de negócio (nome de coleção já existe, HQ não encontrada, …) fica nos
 * serviços, que lançam `AppError` com o código apropriado.
 */

export const zComicId = z.uuid()
export const zCollectionId = z.uuid()

export const zTitle = z.string().trim().min(1).max(TITLE_MAX_LENGTH)
export const zCollectionName = z.string().trim().min(1).max(COLLECTION_NAME_MAX_LENGTH)
export const zCollectionDescription = z
  .string()
  .trim()
  .max(COLLECTION_DESCRIPTION_MAX_LENGTH)
  .nullable()

export const zReaderMode = z.enum(['single', 'double', 'vertical'])
export const zFitMode = z.enum(['height', 'width', 'original'])

export const zReaderPrefs = z.object({
  mode: zReaderMode,
  fit: zFitMode,
  zoom: z.number().min(0.25).max(4),
  verticalWidth: z.number().min(0.2).max(1),
  doubleOffset: z.boolean(),
})

export const zReadStatusFilter = z.enum(['all', 'unread', 'reading', 'read'])
export const zReadStatus = z.enum(['read', 'unread'])

export const zLibraryQuery = z.object({
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['title', 'createdAt', 'lastReadAt']),
  order: z.enum(['asc', 'desc']),
  status: zReadStatusFilter,
  favoritesOnly: z.boolean(),
  collectionId: zCollectionId.optional(),
  limit: z.number().int().min(1).max(500),
  offset: z.number().int().min(0),
})

export const zComicIdList = z.array(zComicId).min(1).max(1000)

export const zCollectionType = z.enum(['list', 'saga'])

export const zCollectionCreateInput = z.object({
  type: zCollectionType,
  name: zCollectionName,
  description: zCollectionDescription.optional(),
  comicIds: z.array(zComicId).optional(),
})

export const zCollectionUpdateInput = z.object({
  name: zCollectionName.optional(),
  description: zCollectionDescription.optional(),
  type: zCollectionType.optional(),
})

export const zCollectionCoverInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('comic'), comicId: zComicId }),
  z.object({ mode: z.literal('image'), path: z.string().min(1) }),
])

export const zImportPaths = z.array(z.string().min(1)).min(1).max(5000)
export const zJobId = z.string().min(1)
export const zImportDuplicateDecision = z.enum(['skip', 'import'])

export const zSettingsPatch = z
  .object({
    'reader.defaults': zReaderPrefs,
    'reader.focusMode': z.boolean(),
    'cache.maxBytes': z.number().int().min(CACHE_MIN_BYTES).max(CACHE_MAX_BYTES),
    'library.view': z.object({
      sort: z.enum(['title', 'createdAt', 'lastReadAt']),
      order: z.enum(['asc', 'desc']),
      status: zReadStatusFilter,
      favoritesOnly: z.boolean(),
    }),
    'ui.sidebarCollapsed': z.boolean(),
    'window.bounds': z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        maximized: z.boolean(),
      })
      .nullable(),
    'import.duplicatePolicy': z.literal('ask'),
  })
  .partial()
