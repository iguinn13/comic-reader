import { logger } from './logger'

let enabled = false

/** RNF-01: liga o log de tempos (só em dev, decidido em `main/index.ts`). */
export function setPerfLogging(value: boolean): void {
  enabled = value
}

/** Roda `fn` e, com o log ligado, registra "[perf] rótulo: N ms". Não altera o resultado nem o erro de `fn`. */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    logger.info(`[perf] ${label}: ${(performance.now() - start).toFixed(1)} ms`)
  }
}
