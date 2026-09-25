import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'
import { useLibraryScanState } from './use-library-scan-subscription'

/**
 * Substitui o antigo botão "Importar" (RF-60): dispara um re-scan manual das
 * pastas-raiz configuradas — não existe mais inserção manual de HQs, o
 * usuário só organiza os arquivos fora do app (docs/05-importacao.md).
 */
export function RefreshLibraryButton({
  iconOnly,
  className,
}: {
  iconOnly: boolean
  className?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const { scanning } = useLibraryScanState()
  const label = t(scanning ? 'library.scan.scanning' : 'library.scan.action')

  return (
    <Button
      variant="outline"
      className={cn('gap-2', className)}
      disabled={scanning}
      title={iconOnly ? label : undefined}
      onClick={() => void api.library.scan()}
    >
      <RefreshCw className={cn('size-4', scanning && 'animate-spin')} aria-hidden />
      {!iconOnly && <span className="truncate">{label}</span>}
    </Button>
  )
}
