import log from 'electron-log/main'
import type { AppPaths } from './paths'

/**
 * Inicializa o electron-log: escreve em `userData/logs/main.log` (RNF-05/RNF-12
 * dependem de logs confiáveis para depurar falhas de importação e do cache).
 * Chamar uma única vez, no boot do main, antes de qualquer outro serviço.
 */
export function initLogger(paths: AppPaths): void {
  log.transports.file.resolvePathFn = () => `${paths.logsDir}/main.log`
  log.transports.file.level = 'info'
  log.transports.console.level = import.meta.env.DEV ? 'debug' : false
  log.errorHandler.startCatching()
}

export { log as logger }
