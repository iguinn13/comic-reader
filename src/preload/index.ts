import { contextBridge } from 'electron'

/**
 * Só o preload roda com acesso ao Node, então ele é o único lugar autorizado
 * a construir `window.api`. Nada além de funções de domínio explícitas passa
 * daqui para o renderer — nunca `ipcRenderer`, `require` ou `process` crus
 * (checklist de segurança em docs/02-arquitetura.md §6).
 *
 * A interface completa (`ComicReaderApi`, definida em src/shared/api.ts) e os
 * handlers correspondentes no main chegam no milestone M1 — por enquanto só
 * um objeto vazio, para o renderer já poder importar `window.api` sem erro.
 */
const api = {} as const

const versions = {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
} as const

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('versions', versions)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error — só ocorre se contextIsolation for desligada (não deve acontecer, ver window.ts)
  window.api = api
  // @ts-expect-error — idem
  window.versions = versions
}
