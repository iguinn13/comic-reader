import {
  ArrowLeft,
  BookOpen,
  GalleryVerticalEnd,
  Heart,
  Maximize,
  Minimize,
  MoreHorizontal,
  Moon,
  RectangleVertical,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import { DEFAULT_READER_PREFS } from '@shared/constants'
import type { FitMode, ReaderMode } from '@shared/types'
import { stepVerticalWidth, stepZoom } from './zoom'

interface ReaderTopBarProps {
  title: string
  mode: ReaderMode
  fit: FitMode
  zoom: number
  verticalWidth: number
  doubleOffset: boolean
  isFavorite: boolean
  isFullscreen: boolean
  focusMode: boolean
  onBack: () => void
  onModeChange: (mode: ReaderMode) => void
  onFitChange: (fit: FitMode) => void
  onZoomChange: (zoom: number) => void
  onVerticalWidthChange: (verticalWidth: number) => void
  onToggleDoubleOffset: () => void
  onToggleFavorite: () => void
  onToggleFullscreen: () => void
  onToggleFocusMode: () => void
  onMarkUnread: () => void
  onResetPrefs: () => void
}

const MODE_ICONS: Record<ReaderMode, typeof RectangleVertical> = {
  single: RectangleVertical,
  double: BookOpen,
  vertical: GalleryVerticalEnd,
}

/** Barra superior do leitor (docs/06-leitor.md §2). O modo vertical chega em M4.7. */
export function ReaderTopBar({
  title,
  mode,
  fit,
  zoom,
  verticalWidth,
  doubleOffset,
  isFavorite,
  isFullscreen,
  focusMode,
  onBack,
  onModeChange,
  onFitChange,
  onZoomChange,
  onVerticalWidthChange,
  onToggleDoubleOffset,
  onToggleFavorite,
  onToggleFullscreen,
  onToggleFocusMode,
  onMarkUnread,
  onResetPrefs,
}: ReaderTopBarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'app-drag flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface/85 pl-3 backdrop-blur',
        // Deixa livre a área dos botões nativos da janela (titleBarOverlay), exceto em tela cheia.
        isFullscreen ? 'pr-3' : 'pr-36',
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="app-no-drag"
        aria-label={t('reader.back')}
        onClick={onBack}
      >
        <ArrowLeft className="size-5" />
      </Button>

      <span className="truncate text-sm font-medium text-text">{title}</span>

      <div className="app-no-drag ml-auto flex items-center gap-1">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
          {(['single', 'double', 'vertical'] as const).map((option) => {
            const Icon = MODE_ICONS[option]
            return (
              <button
                key={option}
                type="button"
                title={t(`reader.mode.${option}`)}
                aria-pressed={mode === option}
                onClick={() => onModeChange(option)}
                className={cn(
                  'flex size-7 items-center justify-center rounded transition-colors duration-150 ease-out',
                  mode === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
                )}
              >
                <Icon className="size-4" />
              </button>
            )
          })}
        </div>

        {mode !== 'vertical' && (
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {(['height', 'width', 'original'] as const).map((option) => (
              <button
                key={option}
                type="button"
                title={t(`reader.fit.${option}`)}
                onClick={() => onFitChange(option)}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                  fit === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
                )}
              >
                {t(`reader.fit.${option}`)}
              </button>
            ))}
          </div>
        )}

        {mode === 'vertical' ? (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('reader.zoomOut')}
              onClick={() => onVerticalWidthChange(stepVerticalWidth(verticalWidth, -1))}
            >
              <ZoomOut className="size-4" />
            </Button>
            <button
              type="button"
              title={t('reader.zoomReset')}
              onClick={() => onVerticalWidthChange(DEFAULT_READER_PREFS.verticalWidth)}
              className="w-12 text-center text-xs tabular-nums text-text-muted hover:text-text"
            >
              {Math.round(verticalWidth * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('reader.zoomIn')}
              onClick={() => onVerticalWidthChange(stepVerticalWidth(verticalWidth, 1))}
            >
              <ZoomIn className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('reader.zoomOut')}
              onClick={() => onZoomChange(stepZoom(zoom, -1))}
            >
              <ZoomOut className="size-4" />
            </Button>
            <button
              type="button"
              title={t('reader.zoomReset')}
              onClick={() => onZoomChange(1)}
              className="w-12 text-center text-xs tabular-nums text-text-muted hover:text-text"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('reader.zoomIn')}
              onClick={() => onZoomChange(stepZoom(zoom, 1))}
            >
              <ZoomIn className="size-4" />
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-pressed={isFavorite}
          aria-label={t('reader.favorite')}
          onClick={onToggleFavorite}
        >
          <Heart className={cn('size-4', isFavorite && 'fill-danger text-danger')} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('reader.moreActions')}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {mode === 'double' && (
              <DropdownMenuItem onSelect={onToggleDoubleOffset}>
                {doubleOffset ? t('reader.menu.doubleOffsetOff') : t('reader.menu.doubleOffsetOn')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onMarkUnread}>
              {t('reader.menu.markUnread')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onResetPrefs}>
              {t('reader.menu.resetPrefs')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          aria-pressed={focusMode}
          aria-label={t('reader.focusMode')}
          onClick={onToggleFocusMode}
        >
          <Moon className={cn('size-4', focusMode && 'text-accent')} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t('reader.fullscreen')}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
