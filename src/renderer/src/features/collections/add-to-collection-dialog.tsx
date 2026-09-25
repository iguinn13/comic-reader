import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import { toast } from '@renderer/stores/toast-store'
import { AppError } from '@shared/errors'
import { COLLECTION_NAME_MAX_LENGTH } from '@shared/constants'
import type { CollectionSummary, CollectionType, ComicId } from '@shared/types'

interface AddToCollectionDialogProps {
  comicIds: ComicId[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Adicionar a…" (RF-19, RF-23, RF-44): marca/desmarca as HQs em listas e
 * sagas (check = todas já estão, traço = só parte) e cria uma coleção nova
 * já com elas. Usado pelo card, pela barra de seleção e pelo leitor.
 */
export function AddToCollectionDialog(props: AddToCollectionDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>{props.open && <AddToCollectionBody {...props} />}</DialogContent>
    </Dialog>
  )
}

function AddToCollectionBody({
  comicIds,
  onOpenChange,
}: AddToCollectionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CollectionType>('list')

  const lists = useQuery({
    queryKey: queryKeys.collections.list('list', 'name'),
    queryFn: () => api.collections.list('list', 'name'),
  })
  const sagas = useQuery({
    queryKey: queryKeys.collections.list('saga', 'name'),
    queryFn: () => api.collections.list('saga', 'name'),
  })
  const membership = useQuery({
    queryKey: queryKeys.collections.membership(comicIds),
    queryFn: () => api.collections.membership(comicIds),
  })

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
  }

  const toggle = useMutation({
    mutationFn: async (collection: CollectionSummary): Promise<void> => {
      if (membership.data?.[collection.id] === 'all') {
        await api.collections.removeItems(collection.id, comicIds)
        toast(t('toast.removedFrom', { name: collection.name }), {
          label: t('toast.undo'),
          run: () => void api.collections.addItems(collection.id, comicIds).then(refresh),
        })
      } else {
        await api.collections.addItems(collection.id, comicIds)
        toast(t('toast.addedTo', { name: collection.name }), {
          label: t('toast.undo'),
          run: () => void api.collections.removeItems(collection.id, comicIds).then(refresh),
        })
      }
    },
    onSuccess: refresh,
  })

  const create = useMutation({
    mutationFn: () => api.collections.create({ type: newType, name: newName.trim(), comicIds }),
    onSuccess: () => {
      refresh()
      onOpenChange(false)
    },
  })

  const groups: { type: CollectionType; items: CollectionSummary[] }[] = [
    { type: 'list', items: lists.data ?? [] },
    { type: 'saga', items: sagas.data ?? [] },
  ]

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('collections.addTo.title')}</DialogTitle>
      </DialogHeader>

      <div className="max-h-64 overflow-y-auto">
        {groups.map(({ type, items }) =>
          items.length === 0 ? null : (
            <section key={type} className="mb-2">
              <h3 className="px-2 py-1 text-xs font-medium uppercase text-text-subtle">
                {t(`nav.${type === 'saga' ? 'sagas' : 'lists'}`)}
              </h3>
              <ul>
                {items.map((collection) => {
                  const state = membership.data?.[collection.id]
                  return (
                    <li key={collection.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2">
                        <Checkbox
                          checked={
                            state === 'all' ? true : state === 'some' ? 'indeterminate' : false
                          }
                          onCheckedChange={() => toggle.mutate(collection)}
                        />
                        <span className="truncate">{collection.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          ),
        )}
      </div>

      <form
        className="flex flex-col gap-2 border-t border-border pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (newName.trim()) create.mutate()
        }}
      >
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
          {(['list', 'saga'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setNewType(option)}
              className={cn(
                'flex-1 rounded px-3 py-1 text-sm transition-colors duration-150 ease-out',
                newType === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
              )}
            >
              {t(`collections.new.${option}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newName}
            maxLength={COLLECTION_NAME_MAX_LENGTH}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t('collections.dialog.name')}
          />
          <Button type="submit" disabled={create.isPending || !newName.trim()}>
            {t('collections.addTo.create')}
          </Button>
        </div>
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {t(create.error instanceof AppError ? create.error.message : 'errors.internal')}
          </p>
        )}
      </form>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('collections.addTo.done')}
        </Button>
      </DialogFooter>
    </>
  )
}
