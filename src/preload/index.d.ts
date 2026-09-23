export interface AppVersions {
  chrome: string
  electron: string
  node: string
}

declare global {
  interface Window {
    // Preenchido no milestone M1 com o contrato completo de src/shared/api.ts.
    api: Record<string, never>
    versions: AppVersions
  }
}
