import { eq } from 'drizzle-orm'
import { SETTINGS_DEFAULTS } from '@shared/constants'
import type { Settings } from '@shared/types'
import type { Db } from '../client'
import { settings } from '../schema'
export type SettingKey = keyof Settings
export function getSetting<K extends SettingKey>(db: Db, key: K): Settings[K] {
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  if (!row) return SETTINGS_DEFAULTS[key]
  return JSON.parse(row.value) as Settings[K]
}
export function getAllSettings(db: Db): Settings {
  const rows = db.select().from(settings).all()
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const entries = (Object.keys(SETTINGS_DEFAULTS) as SettingKey[]).map((key) => {
    const raw = byKey.get(key)
    const value: unknown = raw !== undefined ? JSON.parse(raw) : SETTINGS_DEFAULTS[key]
    return [key, value] as const
  })
  return Object.fromEntries(entries) as unknown as Settings
}
export function setSetting<K extends SettingKey>(db: Db, key: K, value: Settings[K]): void {
  const json = JSON.stringify(value)
  db.insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run()
}
