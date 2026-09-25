import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FolderEntry } from '@shared/types'

/**
 * Card de subpasta na navegação por pastas (RF-64, docs/07-ui-ux.md §4.2):
 * mesma proporção 2:3 do `ComicCard`, pra ficar na mesma grade sem quebrar o
 * layout, mas sem capa/menu — só entra na pasta ao clicar.
 */
export function FolderCard({
  entry,
  onOpen,
}: {
  entry: FolderEntry
  onOpen: () => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
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
}
