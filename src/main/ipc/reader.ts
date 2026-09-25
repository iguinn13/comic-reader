import { ipcMain } from 'electron'
import { z } from 'zod'
import { CH } from '@shared/channels'
import { zCollectionId, zComicId, zReaderPrefs } from '@shared/schemas'
import type { ReaderService } from '../services/reader-service'
import { handle } from './handle'

export function registerReaderIpc(service: ReaderService): void {
  handle(CH.reader.open, z.tuple([zComicId, zCollectionId.optional()]), ([comicId, fromId]) =>
    service.open(comicId, fromId),
  )
  handle(CH.reader.savePrefs, z.tuple([zComicId, zReaderPrefs]), ([comicId, prefs]) =>
    service.savePrefs(comicId, prefs),
  )
  handle(CH.reader.resetPrefs, z.tuple([zComicId]), ([comicId]) => service.resetPrefs(comicId))
  handle(CH.reader.complete, z.tuple([zComicId]), ([comicId]) => service.complete(comicId))
  handle(CH.reader.close, z.tuple([zComicId]), ([comicId]) => service.close(comicId))

  // Fire-and-forget (docs/04 §4.4): sem envelope `Result`, chamado a cada
  // troca de página — o preload já tipa os argumentos, então não passa pelo
  // helper `handle()` (que sempre embrulha a resposta e valida com zod).
  ipcMain.handle(CH.reader.setPage, (_event, comicId: string, page: number) => {
    service.setPage(comicId, page)
  })
  ipcMain.handle(
    CH.reader.reportPageSize,
    (_event, comicId: string, index: number, width: number, height: number) => {
      service.reportPageSize(comicId, index, width, height)
    },
  )
}
