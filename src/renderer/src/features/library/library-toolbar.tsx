import { Heart, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { LibraryQuery } from '@shared/types'
import type { LibrarySortOption } from './library-sort'
const STATUS_OPTIONS: LibraryQuery['status'][] = ['all', 'unread', 'reading', 'read']
const SORT_OPTIONS: LibrarySortOption[] = ['createdAt', 'lastReadAt', 'titleAsc', 'titleDesc']
interface LibraryToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  status: LibraryQuery['status']
  onStatusChange: (value: LibraryQuery['status']) => void
  favoritesOnly: boolean
  onFavoritesOnlyChange: (value: boolean) => void
  sortOption: LibrarySortOption
  onSortOptionChange: (value: LibrarySortOption) => void
  hideFilters?: boolean
}
export function LibraryToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  sortOption,
  onSortOptionChange,
  hideFilters,
}: LibraryToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('library.searchPlaceholder')}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('library.clearSearch')}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {!hideFilters && (
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onStatusChange(option)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                status === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
              )}
            >
              {t(`library.status.${option}`)}
            </button>
          ))}
        </div>
      )}

      {!hideFilters && (
        <button
          type="button"
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          aria-pressed={favoritesOnly}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ease-out',
            favoritesOnly
              ? 'border-accent bg-accent/10 text-accent'
              : 'bg-surface text-text-muted hover:text-text',
          )}
        >
          <Heart className={cn('size-3.5', favoritesOnly && 'fill-current')} />
          {t('library.favoritesOnly')}
        </button>
      )}

      <select
        value={sortOption}
        onChange={(event) => onSortOptionChange(event.target.value as LibrarySortOption)}
        aria-label={t('library.sortLabel')}
        className="ml-auto h-8 rounded-md border border-border bg-surface px-2 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {t(`library.sort.${option}`)}
          </option>
        ))}
      </select>
    </div>
  )
}
