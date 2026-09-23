import { dialog } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import { IMPORTABLE_EXTENSIONS } from '@shared/constants'
import { zComicId, zImportDuplicateDecision, zImportPaths, zJobId } from '@shared/schemas'
import type { ImportService } from '../services/import-service'
import { handle } from './handle'

/**
 * `pickFiles` usa `dialog.showOpenDialog` diretamente: é um adaptador de UI
 * do sistema operacional, não regra de negócio (docs/02-arquitetura.md §3
 * permite isso nos handlers/adaptadores, diferente dos serviços).
 */
export function registerImporterIpc(service: ImportService): void {
  handle(CH.importer.pickFiles, z.tuple([]), async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar HQs',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'HQs e imagens compactadas',
          extensions: IMPORTABLE_EXTENSIONS.map((ext) => ext.replace(/^\./, '')),
        },
      ],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  handle(CH.importer.start, z.tuple([zImportPaths]), ([paths]) => service.start(paths))

  handle(CH.importer.cancel, z.tuple([zJobId]), ([jobId]) => service.cancel(jobId))

  handle(
    CH.importer.resolveDuplicate,
    z.tuple([zJobId, zComicId, zImportDuplicateDecision, z.boolean()]),
    ([jobId, itemId, decision, applyToAll]) =>
      service.resolveDuplicate(jobId, itemId, decision, applyToAll),
  )

  handle(CH.importer.getJob, z.tuple([]), () => service.getJob())
}
