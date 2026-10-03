import type { Settings } from '@shared/types'
import type { Db } from '../db/client'
import { resetAllReaderPrefs } from '../db/repositories/progress'
import { getAllSettings, setSetting, type SettingKey } from '../db/repositories/settings'
export class SettingsService {
  constructor(
    private readonly db: Db,
    private readonly onCacheLimitChanged?: () => void,
  ) {}
  get(): Settings {
    return getAllSettings(this.db)
  }
  update(patch: Partial<Settings>): Settings {
    for (const key of Object.keys(patch) as SettingKey[]) {
      setSetting(this.db, key, patch[key] as Settings[typeof key])
    }
    if (patch['cache.maxBytes'] !== undefined) this.onCacheLimitChanged?.()
    return this.get()
  }
  resetAllReaderPrefs(): void {
    resetAllReaderPrefs(this.db)
  }
}
