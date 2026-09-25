import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import { AppError } from '@shared/errors'
import type { CollectionCoverInput, CollectionDetail } from '@shared/types'

/** Capa da coleção (RF-25): automática, imagem própria ou capa de uma HQ da coleção. */
export function CoverDialog({
  collection,
  open,
  onOpenChange,
}: {
  collection: CollectionDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (cover: CollectionCoverInput | 'pick-image') => {
      if (cover === 'pick-image') {
        const path = await api.collections.pickCoverImage()
        if (!path) return null
        return api.collections.setCover(collection.id, { mode: 'image', path })
      }
      return api.collections.setCover(collection.id, cover)
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
      if (result) onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('collections.cover.title')}</DialogTitle>
          <DialogDescription>{t('collections.cover.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            variant={collection.coverMode === 'auto' ? 'default' : 'outline'}
            disabled={isPending}
            onClick={() => mutate({ mode: 'auto' })}
          >
            {t('collections.cover.auto')}
          </Button>
          <Button
            variant={collection.coverMode === 'image' ? 'default' : 'outline'}
            disabled={isPending}
            onClick={() => mutate('pick-image')}
          >
            {t('collections.cover.image')}
          </Button>
        </div>

        {collection.items.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">{t('collections.cover.fromComic')}</p>
            <ul className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto">
              {collection.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={isPending}
                    title={item.title}
                    onClick={() => mutate({ mode: 'comic', comicId: item.id })}
                    className={cn(
                      'aspect-2/3 w-full overflow-hidden rounded-md bg-surface-2 text-xs text-text-subtle',
                      collection.coverMode === 'comic' &&
                        collection.coverComicId === item.id &&
                        'ring-2 ring-accent',
                    )}
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="size-full object-cover"
                      />
                    ) : (
                      item.title
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(error instanceof AppError ? error.message : 'errors.internal')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('collections.addTo.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
