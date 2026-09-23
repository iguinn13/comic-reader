import type { ComicReaderApi } from '@shared/api'

export interface AppVersions {
  chrome: string
  electron: string
  node: string
}

declare global {
  interface Window {
    api: ComicReaderApi
    versions: AppVersions
  }
}
