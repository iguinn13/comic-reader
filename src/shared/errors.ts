/**
 * Formato de erro e envelope de resultado para todo o IPC (docs/04-contratos-ipc.md §3).
 * `message` é sempre uma chave i18n (ex.: "errors.fileMissing"), nunca texto pronto.
 */
export type AppErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'
  | 'FILE_MISSING'
  | 'IO'
  | 'CANCELLED'
  | 'INTERNAL'

export interface AppErrorPayload {
  code: AppErrorCode
  message: string
  details?: unknown
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload }

/** Erro de domínio lançado pelos serviços do main; os handlers IPC o convertem em `Result`. */
export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details?: unknown

  constructor(code: AppErrorCode, messageKey: string, details?: unknown) {
    super(messageKey)
    this.code = code
    this.details = details
    this.name = 'AppError'
  }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: AppErrorCode, message: string, details?: unknown): Result<never> {
  return { ok: false, error: { code, message, details } }
}

/**
 * Converte qualquer exceção capturada num handler IPC para `Result`. Não loga:
 * por não poder importar `electron-log` aqui (src/shared é neutro de Node), o
 * `handle()` do main (src/main/ipc/handle.ts) é quem loga o `error` original
 * com stack sempre que o código resultante for 'INTERNAL' (docs/04 §3).
 */
export function toResult<T>(error: unknown): Result<T> {
  if (error instanceof AppError) {
    return err(error.code, error.message, error.details)
  }
  const message = error instanceof Error ? error.message : String(error)
  return err('INTERNAL', 'errors.internal', message)
}
