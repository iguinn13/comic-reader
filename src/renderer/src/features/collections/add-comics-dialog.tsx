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
import type { CollectionId, ComicId, LibraryQuery } from '@shared/types'

interface AddComicsDialogProps {
  collectionId: CollectionId
  /** HQs que já estão na coleção (aparecem marcadas e desabilitadas). */
  existingIds: Set<ComicId>
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Seletor "Adicionar HQs" (RF-23): busca na biblioteca com multisseleção. */
export function AddComicsDialog(props: AddComicsDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <AddComicsForm key={String(props.open)} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function AddComicsForm({
  collectionId,
  existingIds,
  onOpenChange,
}: AddComicsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<ComicId>>(new Set())

  const query: LibraryQuery = {
    search: search.trim() || undefined,
    sort: 'title',
    order: 'asc',
    status: 'all',
    favoritesOnly: false,
    limit: 100,
    offset: 0,
  }
  const { data } = useQuery({
    queryKey: queryKeys.library.list(query),
    queryFn: () => api.library.list(query),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.collections.addItems(collectionId, [...selected]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
      onOpenChange(false)
    },
  })

  function toggle(id: ComicId): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('collections.add.title')}</DialogTitle>
      </DialogHeader>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('library.searchPlaceholder')}
      />
      <ul className="max-h-72 overflow-y-auto">
        {(data?.items ?? []).map((comic) => {
          const already = existingIds.has(comic.id)
          return (
            <li key={comic.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-text hover:bg-surface-2">
                <Checkbox
                  checked={already || selected.has(comic.id)}
                  disabled={already}
                  onCheckedChange={() => toggle(comic.id)}
                />
                <span className="truncate">{comic.title}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('collections.dialog.cancel')}
        </Button>
        <Button disabled={isPending || selected.size === 0} onClick={() => mutate()}>
          {t('collections.add.confirm', { count: selected.size })}
        </Button>
      </DialogFooter>
    </>
  )
}
