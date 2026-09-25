import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import type { ComicId, ComicSummary } from '@shared/types'

interface EndPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comicTitle: string
  nextInFolder: ComicSummary | null
  onReadNext: (comicId: ComicId) => void
  onBackToLibrary: () => void
}

/**
 * Painel de fim (docs/06-leitor.md §8, RF-42): "Continuar" para o próximo
 * arquivo (ordem natural) da mesma pasta, quando existe, e os botões de
 * baixo. Sem próximo arquivo, só os botões de baixo aparecem.
 */
export function EndPanel({
  open,
  onOpenChange,
  comicTitle,
  nextInFolder,
  onReadNext,
  onBackToLibrary,
}: EndPanelProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reader.endPanel.title', { title: comicTitle })}</DialogTitle>
        </DialogHeader>

        {nextInFolder && (
          <div className="flex items-center gap-3">
            {nextInFolder.coverUrl ? (
              <img src={nextInFolder.coverUrl} alt="" className="h-16 w-11 rounded object-cover" />
            ) : (
              <div className="h-16 w-11 rounded bg-surface-2" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">{t('reader.endPanel.nextInFolder')}</p>
              <p className="truncate text-sm font-medium text-text">{nextInFolder.title}</p>
            </div>
            <Button onClick={() => onReadNext(nextInFolder.id)}>{t('reader.endPanel.read')}</Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('reader.endPanel.stayHere')}
          </Button>
          <Button variant={nextInFolder ? 'outline' : 'default'} onClick={onBackToLibrary}>
            {t('reader.endPanel.backToLibrary')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
