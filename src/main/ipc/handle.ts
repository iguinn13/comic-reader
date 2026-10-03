import { ipcMain } from 'electron'
import type { ZodType } from 'zod'
import { err, ok, toResult, type Result } from '@shared/errors'
import { logger } from '../utils/logger'
export function handle<I, O>(
  channel: string,
  schema: ZodType<I>,
  fn: (input: I) => O | Promise<O>,
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<Result<O>> => {
    const parsed = schema.safeParse(args)
    if (!parsed.success) {
      return err('VALIDATION', 'errors.validation', parsed.error.flatten())
    }
    try {
      return ok(await fn(parsed.data))
    } catch (error) {
      const result = toResult<O>(error)
      if (!result.ok && result.error.code === 'INTERNAL') {
        logger.error(`[ipc] erro interno em "${channel}":`, error)
      }
      return result
    }
  })
}
