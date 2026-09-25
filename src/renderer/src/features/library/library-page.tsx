import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'
import { useSelectionStore } from '@renderer/stores/selection-store'
import { SETTINGS_DEFAULTS } from '@shared/constants'
import type { LibraryQuery } from '@shared/types'
import { FolderBrowser } from './folder-browser'
import { LibraryGrid } from './library-grid'
import { LibraryToolbar } from './library-toolbar'
import type { LibrarySortOption } from './library-sort'
import { SelectionBar } from './selection-bar'
import { useLibraryComics } from './use-library-comics'

type BrowseMode = 'flat' | 'folders'

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
    // "Ver tudo" da Início (docs/07 §4.1): chega com `?view=flat&status=reading&sort=lastReadAt`.
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

  // RF-64: local, como o resto dos filtros desta tela (`use-library-comics.ts`) — não persiste entre sessões.
  // "Ver tudo" da Início chega com `?view=flat`: abre direto em "Todas as HQs".
  const [mode, setMode] = useState<BrowseMode>(
    searchParams.get('view') === 'flat' ? 'flat' : SETTINGS_DEFAULTS['library.view'].mode,
  )

  async function handleAddFolder(): Promise<void> {
    const folder = await api.libraryFolders.add()
    if (folder) await api.library.scan()
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">{t('library.title')}</h1>
        {!isEmptyLibrary && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-text-muted">
              {search
                ? t('library.countFiltered', { count: total, search })
                : t('library.count', { count: total })}
            </p>
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
              {(['folders', 'flat'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out',
                    mode === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {t(`library.browseMode.${option}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isEmptyLibrary && mode === 'flat' && hasSelection && <SelectionBar />}
      {!isEmptyLibrary && mode === 'flat' && !hasSelection && (
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
              <Button onClick={() => void handleAddFolder()}>
                {t('emptyState.library.action')}
              </Button>
            }
          />
        ) : mode === 'folders' ? (
          <FolderBrowser />
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
