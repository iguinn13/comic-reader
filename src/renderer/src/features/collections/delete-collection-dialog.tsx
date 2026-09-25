import { useEffect, useRef } from 'react'
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
import type { CollectionSummary } from '@shared/types'

/** Confirmação de exclusão de coleção (RF-22): nunca exclui as HQs. */
export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  onDeleted,
}: {
  collection: CollectionSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.collections.delete(collection.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
      onOpenChange(false)
      onDeleted()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('collections.delete.title', { name: collection.name })}</DialogTitle>
          <DialogDescription>{t('collections.delete.description')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => onOpenChange(false)}>
            {t('collections.dialog.cancel')}
          </Button>
          <Button variant="danger" disabled={isPending} onClick={() => mutate()}>
            {t('collections.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
