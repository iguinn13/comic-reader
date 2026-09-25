import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Image as ImageIcon, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { ComicCard } from '@renderer/features/library/comic-card'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { AddComicsDialog } from './add-comics-dialog'
import { CoverDialog } from './cover-dialog'
import { CollectionDialog } from './collection-dialog'
import { DeleteCollectionDialog } from './delete-collection-dialog'
import { SagaList } from './saga-list'

/** Detalhe da coleção (RF-23, RF-24): saga numerada e reordenável; lista em grade na ordem de adição. */
export function CollectionDetailPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { collectionId = '' } = useParams<{ collectionId: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)

  const { data: collection, isError } = useQuery({
    queryKey: queryKeys.collections.detail(collectionId),
    queryFn: () => api.collections.get(collectionId),
  })

  if (isError) {
    return <EmptyState title={t('errors.collectionNotFound')} />
  }
  if (!collection) return <div className="p-8" />

  const isSaga = collection.type === 'saga'
  const backTo = isSaga ? '/sagas' : '/lists'
  const allRead = collection.itemCount > 0 && collection.readCount === collection.itemCount
  const progress = collection.itemCount > 0 ? collection.readCount / collection.itemCount : 0

  async function continueSaga(): Promise<void> {
    const next = await api.collections.nextToRead(collectionId)
    if (next) void navigate(`/read/${next}?from=${collectionId}`)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('reader.back')}
            onClick={() => void navigate(backTo)}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-text">{collection.name}</h1>
            {collection.description && (
              <p className="mt-1 max-w-2xl text-sm text-text-muted">{collection.description}</p>
            )}
            <p className="mt-1 text-sm text-text-muted">
              {isSaga
                ? t('collections.card.readOf', {
                    read: collection.readCount,
                    total: collection.itemCount,
                  })
                : t('library.count', { count: collection.itemCount })}
            </p>
            {isSaga && (
              <div className="mt-2 h-1 w-64 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isSaga && collection.itemCount > 0 && (
            <Button onClick={() => void continueSaga()}>
              <Play className="size-4" aria-hidden />
              {allRead ? t('collections.saga.readAgain') : t('collections.saga.continue')}
            </Button>
          )}
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t('collections.add.button')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('collections.cover.title')}
            onClick={() => setCoverOpen(true)}
          >
            <ImageIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('collections.card.edit')}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('collections.delete.confirm')}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {collection.items.length === 0 ? (
          <EmptyState
            title={t(`collections.detail.emptyTitle.${collection.type}`)}
            action={<Button onClick={() => setAddOpen(true)}>{t('collections.add.button')}</Button>}
          />
        ) : isSaga ? (
          <SagaList collection={collection} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5">
            {collection.items.map((item) => (
              <ComicCard key={item.id} comic={item} />
            ))}
          </div>
        )}
      </div>

      <CollectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        defaultType={collection.type}
        collection={collection}
      />
      <CoverDialog collection={collection} open={coverOpen} onOpenChange={setCoverOpen} />
      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => void navigate(backTo)}
      />
      <AddComicsDialog
        collectionId={collection.id}
        existingIds={new Set(collection.items.map((i) => i.id))}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  )
}
