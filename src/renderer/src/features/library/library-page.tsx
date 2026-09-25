import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { useSelectionStore } from '@renderer/stores/selection-store'
import type { LibraryQuery } from '@shared/types'
import { LibraryGrid } from './library-grid'
import { LibraryToolbar } from './library-toolbar'
import type { LibrarySortOption } from './library-sort'
import { SelectionBar } from './selection-bar'
import { useLibraryComics } from './use-library-comics'

/** Tela Biblioteca (RF-10, 12, 13, 18, docs/07-ui-ux.md §4.2). */
export function LibraryPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const {
    items,
    total,
    search,
    setSearch,
    status,
    setStatus,
    favoritesOnly,
    setFavoritesOnly,
    sortOption,
    setSortOption,
    isLoading,
    fetchNextPage,
  } = useLibraryComics({
    // "Ver tudo" da Início (docs/07 §4.1): chega com `?status=reading&sort=lastReadAt`.
    initialStatus: (searchParams.get('status') as LibraryQuery['status']) ?? undefined,
    initialSortOption: (searchParams.get('sort') as LibrarySortOption) ?? undefined,
  })

  const hasSelection = useSelectionStore((state) => state.selectedIds.size > 0)
  const clearSelection = useSelectionStore((state) => state.clear)

  // Sai da tela ou muda o filtro → a seleção não se aplica mais ao que está visível.
  useEffect(() => clearSelection, [clearSelection])
  useEffect(() => {
    clearSelection()
  }, [search, status, favoritesOnly, sortOption, clearSelection])

  const isEmptyLibrary = !isLoading && total === 0 && !search && status === 'all' && !favoritesOnly
  const isFilteredEmpty = !isLoading && total === 0 && !isEmptyLibrary

  async function handleImport(): Promise<void> {
    const paths = await api.importer.pickFiles()
    if (paths.length === 0) return
    await api.importer.start(paths)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">{t('library.title')}</h1>
        {!isEmptyLibrary && (
          <p className="text-sm text-text-muted">
            {search
              ? t('library.countFiltered', { count: total, search })
              : t('library.count', { count: total })}
          </p>
        )}
      </div>

      {!isEmptyLibrary && hasSelection && <SelectionBar />}
      {!isEmptyLibrary && !hasSelection && (
        <LibraryToolbar
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          sortOption={sortOption}
          onSortOptionChange={setSortOption}
        />
      )}

      <div className="min-h-0 flex-1">
        {isEmptyLibrary ? (
          <EmptyState
            title={t('emptyState.library.title')}
            description={t('emptyState.library.description')}
            action={
              <Button onClick={() => void handleImport()}>{t('emptyState.library.action')}</Button>
            }
          />
        ) : isFilteredEmpty ? (
          <EmptyState
            title={
              search
                ? t('emptyState.search.title', { search })
                : t('emptyState.search.titleGeneric')
            }
            action={
              search ? (
                <Button variant="outline" onClick={() => setSearch('')}>
                  {t('emptyState.search.action')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <LibraryGrid items={items} onEndReached={fetchNextPage} />
        )}
      </div>
    </div>
  )
}
