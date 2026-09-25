import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@renderer/lib/utils'
import type { CollectionSummary } from '@shared/types'

/**
 * Card de coleção (RF-26, docs/07-ui-ux.md): capa, nome, contagem de HQs e,
 * nas sagas, barra de progresso "x de y lidas". Sem capa (coleção vazia),
 * mostra um placeholder com a inicial do nome (RF-25).
 */
export function CollectionCard({
  collection,
  onEdit,
}: {
  collection: CollectionSummary
  onEdit?: (collection: CollectionSummary) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isSaga = collection.type === 'saga'
  const progress = collection.itemCount > 0 ? collection.readCount / collection.itemCount : 0

  return (
    <div className="group flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={collection.name}
        onClick={() => void navigate(`/collections/${collection.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void navigate(`/collections/${collection.id}`)
          }
        }}
        className={cn(
          'relative aspect-2/3 cursor-pointer overflow-hidden rounded-lg bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        )}
      >
        {collection.coverUrl ? (
          <img
            src={collection.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-b from-surface-2 to-surface text-4xl font-semibold text-text-subtle">
            {collection.name.charAt(0).toUpperCase()}
          </div>
        )}

        {onEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(collection)
            }}
            className="absolute right-2 top-2 rounded-md bg-bg/80 px-2 py-1 text-xs text-text opacity-0 transition-opacity duration-150 ease-out hover:bg-bg focus-visible:opacity-100 group-hover:opacity-100"
          >
            {t('collections.card.edit')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="truncate text-sm font-medium text-text">{collection.name}</p>
        <p className="text-xs text-text-muted">
          {isSaga
            ? t('collections.card.readOf', {
                read: collection.readCount,
                total: collection.itemCount,
              })
            : t('library.count', { count: collection.itemCount })}
        </p>
        {isSaga && (
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
