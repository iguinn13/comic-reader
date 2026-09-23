import { createRequire } from 'module'
import type { AppPaths } from './paths'

/**
 * Logger do app (docs/02-arquitetura.md §1: `electron-log`, arquivo em
 * `userData/logs`). Carregado sob demanda (via `require` dinâmico, não
 * `import` estático) e com fallback pro `console`, em vez de importar
 * `electron-log/main` direto no topo do arquivo.
 *
 * Motivo: `electron-log/main` faz `require('electron')` incondicionalmente
 * no seu próprio topo, e o pacote `electron` só resolve de verdade dentro de
 * um processo Electron real em execução — fora dele (ex.: `npx vitest run`
 * em Node puro, usado para testar os serviços do main isoladamente, docs/09
 * §1) esse `require` lança. Como vários serviços (`CoverService`,
 * `ImportService`, `MaintenanceService`, `handle()`) só usam `logger` para
 * registrar erros que não devem derrubar o processo, o fallback pro
 * `console` mantém esse comportamento (nunca lança) tanto em produção quanto
 * nos testes, sem exigir um Electron de verdade rodando.
 */

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
    file: { resolvePathFn: (() => string) | undefined; level: string | false }
    console: { level: string | false }
  }
  errorHandler: { startCatching: () => void }
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

/**
 * Inicializa o electron-log: escreve em `userData/logs/main.log` (RNF-05/RNF-12
 * dependem de logs confiáveis para depurar falhas de importação e do cache).
 * Chamar uma única vez, no boot do main, antes de qualquer outro serviço.
 * Silenciosamente não faz nada se `electron-log` não puder ser carregado
 * (ver comentário no topo do arquivo) — só acontece fora de um Electron real.
 */
export function initLogger(paths: AppPaths): void {
  const log = getElectronLog()
  if (!log) return

  log.transports.file.resolvePathFn = () => `${paths.logsDir}/main.log`
  log.transports.file.level = 'info'
  log.transports.console.level = import.meta.env.DEV ? 'debug' : false
  log.errorHandler.startCatching()
}
