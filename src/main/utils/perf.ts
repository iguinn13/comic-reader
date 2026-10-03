import { logger } from './logger'
let enabled = false
export function setPerfLogging(value: boolean): void {
  enabled = value
}
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    logger.info(`[perf] ${label}: ${(performance.now() - start).toFixed(1)} ms`)
  }
}
