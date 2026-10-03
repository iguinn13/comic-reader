import { useQueryClient } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import type { FolderEntry } from '@shared/types'
export function FolderCard({
  entry,
  onOpen,
}: {
  entry: FolderEntry
  onOpen: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const location = { folderId: entry.folderId, relativePath: entry.relativePath }
  function refresh(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
  }
  const card = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={entry.name}
        className="group relative flex aspect-2/3 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-surface p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {entry.coverUrl ? (
          <>
            <img
              src={entry.coverUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition duration-150 ease-out group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-linear-to-t from-bg/90 to-transparent p-3 pt-8 text-sm font-medium text-text">
              {entry.name}
            </span>
          </>
        ) : (
          <>
            <Folder className="size-10 text-accent transition-transform duration-150 ease-out group-hover:scale-110" />
            <span className="line-clamp-2 text-sm font-medium text-text">{entry.name}</span>
          </>
        )}
      </button>
      <p className="truncate text-xs text-text-muted">
        {t('library.folders.comicCount', { count: entry.comicCount })}
      </p>
    </div>
  )
  if (entry.hasDirectComics) return card
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            void api.library.setFolderCover(location).then((changed) => {
              if (changed) refresh()
            })
          }
        >
          {t('library.folders.setCover')}
        </ContextMenuItem>
        {entry.coverUrl && (
          <ContextMenuItem
            onSelect={() => void api.library.clearFolderCover(location).then(refresh)}
          >
            {t('library.folders.removeCover')}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
