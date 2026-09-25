import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@renderer/components/empty-state'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import type { FolderEntry, FolderLocation } from '@shared/types'
import { ComicCard } from './comic-card'
import { FolderCard } from './folder-card'

const ROOT_LOCATION: FolderLocation = { folderId: null, relativePath: '' }

interface BreadcrumbSegment {
  name: string
  location: FolderLocation
}

/**
 * Navegação por pastas da Biblioteca (RF-64, docs/07-ui-ux.md §4.2): clicar
 * numa pasta entra nela (breadcrumb no topo pra voltar), no estilo do
 * aplicativo "Cover" — sem uma árvore lateral fixa. O estado do "onde estou"
 * é só local (não sobrevive a sair da tela), como o resto dos filtros da
 * Biblioteca (`use-library-comics.ts`).
 */
export function FolderBrowser(): React.JSX.Element {
  const { t } = useTranslation()
  const [path, setPath] = useState<BreadcrumbSegment[]>([])

  const location = path.length > 0 ? path[path.length - 1].location : ROOT_LOCATION

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.folder(location),
    queryFn: () => api.library.browseFolder(location),
  })

  function enter(entry: FolderEntry): void {
    setPath((prev) => [
      ...prev,
      {
        name: entry.name,
        location: { folderId: entry.folderId, relativePath: entry.relativePath },
      },
    ])
  }

  const subfolders = data?.subfolders ?? []
  const comics = data?.comics ?? []
  const isEmptyHere = !isLoading && subfolders.length === 0 && comics.length === 0

  return (
    <div className="flex h-full flex-col gap-4">
      <nav
        className="flex shrink-0 flex-wrap items-center gap-1 text-sm text-text-muted"
        aria-label={t('library.folders.breadcrumb')}
      >
        <button
          type="button"
          onClick={() => setPath([])}
          className={cn('hover:text-text', path.length === 0 && 'font-medium text-text')}
        >
          {t('library.folders.root')}
        </button>
        {path.map((segment, index) => (
          <span key={index} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" />
            <button
              type="button"
              onClick={() => setPath((prev) => prev.slice(0, index + 1))}
              className={cn(
                'hover:text-text',
                index === path.length - 1 && 'font-medium text-text',
              )}
            >
              {segment.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmptyHere ? (
          <EmptyState title={t('library.folders.emptyFolder')} />
        ) : (
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
          >
            {subfolders.map((entry) => (
              <FolderCard
                key={`${entry.folderId}:${entry.relativePath}`}
                entry={entry}
                onOpen={() => enter(entry)}
              />
            ))}
            {comics.map((comic) => (
              <ComicCard key={comic.id} comic={comic} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
