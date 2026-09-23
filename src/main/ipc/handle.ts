import { ipcMain } from 'electron'
import type { ZodType } from 'zod'
import { err, ok, toResult, type Result } from '@shared/errors'
import { logger } from '../utils/logger'

/**
 * Helper genérico para registrar um handler IPC (docs/04-contratos-ipc.md §5).
 * Recebe o canal, o schema zod dos argumentos (tupla, ex.: `z.tuple([zComicId, zTitle])`)
 * e a função de serviço a chamar com esses argumentos já validados.
 *
 * Contrato: sempre devolve `Result<O>` para o renderer, nunca lança. Entrada
 * inválida vira `VALIDATION`; exceções da função viram `AppError` → `Result`
 * de erro via `toResult`, e um `INTERNAL` é sempre logado aqui com stack
 * (docs/04 §3) — `toResult` não pode logar porque `src/shared` é neutro de
 * Node/Electron.
 */
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
