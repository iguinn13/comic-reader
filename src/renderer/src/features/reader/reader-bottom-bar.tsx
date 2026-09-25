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
  const lastIndex = Math.max(1, totalPages - 1)
  const progressPercent = (currentPage / lastIndex) * 100

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
        style={{
          // Trilho preenchido até a página atual (o `range` nativo com appearance-none não preenche).
          background: `linear-gradient(to right, var(--color-accent) ${progressPercent}%, var(--color-surface-2) ${progressPercent}%)`,
        }}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
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
