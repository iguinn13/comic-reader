import type { Settings } from '@shared/types'
import type { Db } from '../db/client'
import { resetAllReaderPrefs } from '../db/repositories/progress'
import { getAllSettings, setSetting, type SettingKey } from '../db/repositories/settings'

/**
 * Leitura/escrita de `settings`, com defaults aplicados (docs/03 §2.6,
 * RF-50..53). Fina o bastante para não precisar de testes próprios: a regra
 * de fallback/serialização já é coberta em src/main/db/repositories/settings.test.ts.
 */
export class SettingsService {
  constructor(private readonly db: Db) {}

  get(): Settings {
    return getAllSettings(this.db)
  }

  update(patch: Partial<Settings>): Settings {
    for (const key of Object.keys(patch) as SettingKey[]) {
      setSetting(this.db, key, patch[key] as Settings[typeof key])
    }
    return this.get()
  }

  /** RF-50 "Aplicar a todas as HQs": limpa as preferências de leitura por HQ. */
  resetAllReaderPrefs(): void {
    resetAllReaderPrefs(this.db)
  }
}
