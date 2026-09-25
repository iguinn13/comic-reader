import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import type { CollectionId, ComicId, SagaContext } from '@shared/types'

/** docs/06-leitor.md §8: uma linha por saga, no máximo 3. */
const MAX_SAGA_ROWS = 3

interface EndPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comicTitle: string
  sagaContext: SagaContext[]
  onReadNext: (comicId: ComicId, sagaId: CollectionId) => void
  onBackToLibrary: () => void
}

/**
 * Painel de fim (docs/06-leitor.md §8, RF-42): "Próxima na saga" por saga
 * que tem próxima HQ, e os botões de baixo. Sem saga (ou última da saga),
 * só os botões de baixo aparecem.
 */
export function EndPanel({
  open,
  onOpenChange,
  comicTitle,
  sagaContext,
  onReadNext,
  onBackToLibrary,
}: EndPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const withNext = sagaContext.filter((saga) => saga.next).slice(0, MAX_SAGA_ROWS)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reader.endPanel.title', { title: comicTitle })}</DialogTitle>
        </DialogHeader>

        {withNext.map((saga) => (
          <div key={saga.sagaId} className="flex items-center gap-3">
            {saga.next?.coverUrl ? (
              <img src={saga.next.coverUrl} alt="" className="h-16 w-11 rounded object-cover" />
            ) : (
              <div className="h-16 w-11 rounded bg-surface-2" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">
                {t('reader.endPanel.nextInSaga', {
                  saga: saga.sagaName,
                  current: saga.position + 2,
                  total: saga.total,
                })}
              </p>
              <p className="truncate text-sm font-medium text-text">{saga.next?.title}</p>
            </div>
            <Button onClick={() => saga.next && onReadNext(saga.next.id, saga.sagaId)}>
              {t('reader.endPanel.read')}
            </Button>
          </div>
        ))}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('reader.endPanel.stayHere')}
          </Button>
          <Button variant={withNext.length > 0 ? 'outline' : 'default'} onClick={onBackToLibrary}>
            {t('reader.endPanel.backToLibrary')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
