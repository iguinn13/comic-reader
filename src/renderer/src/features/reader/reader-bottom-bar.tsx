import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'

interface ReaderBottomBarProps {
  currentPage: number
  totalPages: number
  onGoTo: (pageIndex: number) => void
  onPrev: () => void
  onNext: () => void
  onOpenGoToPage: () => void
}

/** Barra inferior do leitor (docs/06-leitor.md §2): slider, indicador N/total e setas. */
export function ReaderBottomBar({
  currentPage,
  totalPages,
  onGoTo,
  onPrev,
  onNext,
  onOpenGoToPage,
}: ReaderBottomBarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-t border-border bg-surface/85 px-3 backdrop-blur">
      <Button variant="ghost" size="icon" aria-label={t('reader.prevPage')} onClick={onPrev}>
        <ChevronLeft className="size-4" />
      </Button>

      <input
        type="range"
        min={0}
        max={Math.max(0, totalPages - 1)}
        value={currentPage}
        onChange={(event) => onGoTo(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent"
        aria-label={t('reader.pageIndicator', { current: currentPage + 1, total: totalPages })}
      />

      <button
        type="button"
        onClick={onOpenGoToPage}
        className="w-20 shrink-0 text-center text-xs tabular-nums text-text-muted hover:text-text"
      >
        {t('reader.pageIndicator', { current: currentPage + 1, total: totalPages })}
      </button>

      <Button variant="ghost" size="icon" aria-label={t('reader.nextPage')} onClick={onNext}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
