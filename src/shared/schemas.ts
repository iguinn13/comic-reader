import { z } from 'zod'
import { CACHE_MAX_BYTES, CACHE_MIN_BYTES, TITLE_MAX_LENGTH } from './constants'

/**
 * Todo input de IPC passa por um destes schemas no handler do main (RNF-06,
 * docs/04-contratos-ipc.md). Os schemas descrevem só o formato do dado — a
 * regra de negócio (HQ não encontrada, pasta já configurada, …) fica nos
 * serviços, que lançam `AppError` com o código apropriado.
 */

export const zComicId = z.uuid()
export const zFolderId = z.uuid()

export const zTitle = z.string().trim().min(1).max(TITLE_MAX_LENGTH)

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
  limit: z.number().int().min(1).max(500),
  offset: z.number().int().min(0),
})

export const zComicIdList = z.array(zComicId).min(1).max(1000)

export const zDeleteComicOptions = z.object({ deleteFile: z.boolean() })

/** RF-64: nível-topo é `folderId: null` (lista as pastas-raiz); `relativePath` nunca é caminho absoluto. */
export const zFolderLocation = z.object({
  folderId: zFolderId.nullable(),
  relativePath: z.string().max(4096),
})

export const zSettingsPatch = z
  .object({
    'reader.defaults': zReaderPrefs,
    'cache.maxBytes': z.number().int().min(CACHE_MIN_BYTES).max(CACHE_MAX_BYTES),
    'library.view': z.object({
      sort: z.enum(['title', 'createdAt', 'lastReadAt']),
      order: z.enum(['asc', 'desc']),
      status: zReadStatusFilter,
      favoritesOnly: z.boolean(),
      mode: z.enum(['flat', 'folders']),
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
  })
  .partial()
