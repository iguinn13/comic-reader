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
export type Result<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: AppErrorPayload
    }
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
export function toResult<T>(error: unknown): Result<T> {
  if (error instanceof AppError) {
    return err(error.code, error.message, error.details)
  }
  const message = error instanceof Error ? error.message : String(error)
  return err('INTERNAL', 'errors.internal', message)
}
