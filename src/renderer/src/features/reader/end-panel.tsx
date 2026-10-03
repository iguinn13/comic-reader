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
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="line-clamp-3 break-words text-lg leading-snug">
            {t('reader.endPanel.title', { title: comicTitle })}
          </DialogTitle>
        </DialogHeader>

        {nextInFolder && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3">
            {nextInFolder.coverUrl ? (
              <img
                src={nextInFolder.coverUrl}
                alt=""
                className="aspect-2/3 w-16 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="aspect-2/3 w-16 shrink-0 rounded bg-surface-2" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">{t('reader.endPanel.nextInFolder')}</p>
              <p className="mt-1 line-clamp-3 break-words text-sm font-medium text-text">
                {nextInFolder.title}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="sm:items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('reader.endPanel.stayHere')}
          </Button>
          <Button variant="outline" onClick={onBackToLibrary}>
            {t('reader.endPanel.backToLibrary')}
          </Button>
          {nextInFolder && (
            // eslint-disable-next-line jsx-a11y/no-autofocus
            <Button autoFocus onClick={() => onReadNext(nextInFolder.id)}>
              {t('reader.endPanel.read')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
