import { z } from 'zod'
import { CH } from '@shared/channels'
import { zSettingsPatch } from '@shared/schemas'
import type { SettingsService } from '../services/settings-service'
import { handle } from './handle'

export function registerSettingsIpc(service: SettingsService): void {
  handle(CH.settings.get, z.tuple([]), () => service.get())
  handle(CH.settings.update, z.tuple([zSettingsPatch]), ([patch]) => service.update(patch))
  handle(CH.settings.resetAllReaderPrefs, z.tuple([]), () => service.resetAllReaderPrefs())
}
