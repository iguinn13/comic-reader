/** Nomes dos canais IPC, agrupados por domínio (docs/04-contratos-ipc.md §4). */
export const CH = {
  library: {
    home: 'library:home',
    list: 'library:list',
    get: 'library:get',
    rename: 'library:rename',
    setFavorite: 'library:setFavorite',
    setReadStatus: 'library:setReadStatus',
    removeFromContinue: 'library:removeFromContinue',
    delete: 'library:delete',
    stats: 'library:stats',
    scan: 'library:scan',
    onScanProgress: 'library:scanProgress',
    onChanged: 'library:changed',
  },
  libraryFolders: {
    list: 'libraryFolders:list',
    add: 'libraryFolders:add',
    remove: 'libraryFolders:remove',
  },
  reader: {
    open: 'reader:open',
    setPage: 'reader:setPage',
    savePrefs: 'reader:savePrefs',
    resetPrefs: 'reader:resetPrefs',
    complete: 'reader:complete',
    reportPageSize: 'reader:reportPageSize',
    close: 'reader:close',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    resetAllReaderPrefs: 'settings:resetAllReaderPrefs',
  },
  app: {
    info: 'app:info',
    openDataFolder: 'app:openDataFolder',
    clearCache: 'app:clearCache',
    toggleFullscreen: 'app:toggleFullscreen',
    onFullscreenChanged: 'app:fullscreenChanged',
  },
} as const
