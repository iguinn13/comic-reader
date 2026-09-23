import type { AppErrorCode } from '@shared/errors'

/**
 * Mapeia cada `AppErrorCode` que pode aparecer num `ImportItem` falho para a
 * chave i18n da mensagem curta exibida no painel (docs/05-importacao.md §6:
 * "mensagem i18n por errorCode"). `CONFLICT` e `NOT_FOUND` não aparecem nesse
 * fluxo (duplicata é tratada como `awaiting-duplicate-decision`, não como
 * `failed`), então caem no genérico `errors.internal`.
 */
const ERROR_CODE_TO_I18N_KEY: Record<AppErrorCode, string> = {
  UNSUPPORTED_FORMAT: 'errors.unsupportedFormat',
  CORRUPTED_FILE: 'errors.corruptedFile',
  FILE_MISSING: 'errors.io',
  IO: 'errors.io',
  VALIDATION: 'errors.validation',
  CANCELLED: 'errors.cancelled',
  INTERNAL: 'errors.internal',
  CONFLICT: 'errors.internal',
  NOT_FOUND: 'errors.internal',
}

/** Chave i18n a exibir para um item de importação com falha. */
export function importErrorMessageKey(errorCode: AppErrorCode | undefined): string {
  if (!errorCode) return 'errors.internal'
  return ERROR_CODE_TO_I18N_KEY[errorCode]
}
