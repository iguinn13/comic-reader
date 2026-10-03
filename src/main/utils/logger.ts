import { createRequire } from 'module'
import type { AppPaths } from './paths'
interface LogFn {
  (...args: unknown[]): void
}
interface Logger {
  info: LogFn
  warn: LogFn
  error: LogFn
  debug: LogFn
}
interface ElectronLogMain extends Logger {
  transports: {
    file: {
      resolvePathFn: (() => string) | undefined
      level: string | false
    }
    console: {
      level: string | false
    }
  }
  errorHandler: {
    startCatching: () => void
  }
}
const nodeRequire = createRequire(import.meta.url)
let cachedLog: ElectronLogMain | null = null
let loadFailed = false
function getElectronLog(): ElectronLogMain | null {
  if (cachedLog) return cachedLog
  if (loadFailed) return null
  try {
    cachedLog = nodeRequire('electron-log/main') as ElectronLogMain
    return cachedLog
  } catch {
    loadFailed = true
    return null
  }
}
function call(method: keyof Logger, args: unknown[]): void {
  const log = getElectronLog()
  if (log) {
    log[method](...args)
    return
  }
  console[method === 'debug' ? 'log' : method](...args)
}
export const logger: Logger = {
  info: (...args) => call('info', args),
  warn: (...args) => call('warn', args),
  error: (...args) => call('error', args),
  debug: (...args) => call('debug', args),
}
export function initLogger(paths: AppPaths): void {
  const log = getElectronLog()
  if (!log) return
  log.transports.file.resolvePathFn = () => `${paths.logsDir}/main.log`
  log.transports.file.level = 'info'
  log.transports.console.level = import.meta.env.DEV ? 'debug' : false
  log.errorHandler.startCatching()
}
