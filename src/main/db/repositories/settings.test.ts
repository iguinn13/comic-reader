import { SETTINGS_DEFAULTS } from '@shared/constants'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../client'
import { getAllSettings, getSetting, setSetting } from './settings'

let db: Db

beforeEach(() => {
  db = createDb(':memory:')
})

describe('getSetting', () => {
  it('cai no default de SETTINGS_DEFAULTS quando não há linha no banco', () => {
    expect(getSetting(db, 'reader.focusMode')).toBe(SETTINGS_DEFAULTS['reader.focusMode'])
    expect(getSetting(db, 'cache.maxBytes')).toBe(SETTINGS_DEFAULTS['cache.maxBytes'])
    expect(getSetting(db, 'reader.defaults')).toEqual(SETTINGS_DEFAULTS['reader.defaults'])
  })

  it('devolve o valor salvo depois de um setSetting', () => {
    setSetting(db, 'reader.focusMode', true)
    expect(getSetting(db, 'reader.focusMode')).toBe(true)
  })
})

describe('setSetting', () => {
  it('faz upsert: uma segunda escrita substitui a primeira', () => {
    setSetting(db, 'ui.sidebarCollapsed', true)
    setSetting(db, 'ui.sidebarCollapsed', false)

    expect(getSetting(db, 'ui.sidebarCollapsed')).toBe(false)
  })

  it('serializa objetos em JSON e devolve o mesmo objeto de volta', () => {
    setSetting(db, 'library.view', {
      sort: 'title',
      order: 'asc',
      status: 'unread',
      favoritesOnly: true,
      mode: 'flat',
    })

    expect(getSetting(db, 'library.view')).toEqual({
      sort: 'title',
      order: 'asc',
      status: 'unread',
      favoritesOnly: true,
      mode: 'flat',
    })
  })
})

describe('getAllSettings', () => {
  it('mistura valores salvos com defaults para as chaves ausentes', () => {
    setSetting(db, 'reader.focusMode', true)

    const all = getAllSettings(db)

    expect(all['reader.focusMode']).toBe(true)
    expect(all['cache.maxBytes']).toBe(SETTINGS_DEFAULTS['cache.maxBytes'])
    expect(all['reader.defaults']).toEqual(SETTINGS_DEFAULTS['reader.defaults'])
    expect(all['window.bounds']).toBeNull()
  })
})
