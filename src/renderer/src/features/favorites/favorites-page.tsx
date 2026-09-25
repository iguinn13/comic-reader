import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@renderer/components/empty-state'
import { LibraryGrid } from '@renderer/features/library/library-grid'
import { LibraryToolbar } from '@renderer/features/library/library-toolbar'
import { SelectionBar } from '@renderer/features/library/selection-bar'
import { useLibraryComics } from '@renderer/features/library/use-library-comics'
import { useSelectionStore } from '@renderer/stores/selection-store'

/** Tela Favoritas (RF-15, docs/07-ui-ux.md §4.4): reusa a grade da Biblioteca com `favoritesOnly` fixo. */
export function FavoritesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { items, total, search, setSearch, sortOption, setSortOption, isLoading, fetchNextPage } =
    useLibraryComics({ forceFavoritesOnly: true })

  const hasSelection = useSelectionStore((state) => state.selectedIds.size > 0)
  const clearSelection = useSelectionStore((state) => state.clear)

  useEffect(() => clearSelection, [clearSelection])
  useEffect(() => {
    clearSelection()
  }, [search, sortOption, clearSelection])

  const isEmpty = !isLoading && total === 0 && !search

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">{t('nav.favorites')}</h1>
        {!isEmpty && (
          <p className="text-sm text-text-muted">
            {search
              ? t('library.countFiltered', { count: total, search })
              : t('library.count', { count: total })}
          </p>
        )}
      </div>

      {!isEmpty && hasSelection && <SelectionBar />}
      {!isEmpty && !hasSelection && (
        <LibraryToolbar
          search={search}
          onSearchChange={setSearch}
          status="all"
          onStatusChange={() => {}}
          favoritesOnly
          onFavoritesOnlyChange={() => {}}
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
          hideFilters
        />
      )}

      <div className="min-h-0 flex-1">
        {isEmpty ? (
          search ? (
            <EmptyState title={t('emptyState.search.title', { search })} />
          ) : (
            <EmptyState title={t('emptyState.favorites.title')} />
          )
        ) : (
          <LibraryGrid items={items} onEndReached={fetchNextPage} />
        )}
      </div>
    </div>
  )
}
