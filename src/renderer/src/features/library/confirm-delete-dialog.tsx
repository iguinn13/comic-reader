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
import type { ComicId } from '@shared/types'

interface ConfirmDeleteDialogProps {
  comicIds: ComicId[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após a exclusão ter sucesso (ex.: limpar a seleção). */
  onDeleted?: () => void
}

/**
 * Confirmação destrutiva (RF-17, docs/07-ui-ux.md §5): foco inicial em
 * Cancelar, botão de confirmar em `danger`. Serve tanto o menu de contexto
 * (1 HQ) quanto a barra de seleção (N HQs).
 */
export function ConfirmDeleteDialog({
  comicIds,
  open,
  onOpenChange,
  onDeleted,
}: ConfirmDeleteDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  const { mutate: confirmDelete, isPending } = useMutation({
    mutationFn: () => api.library.delete(comicIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
      onOpenChange(false)
      onDeleted?.()
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('library.delete.title', { count: comicIds.length })}</DialogTitle>
          <DialogDescription>{t('library.delete.description')}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => onOpenChange(false)}>
            {t('library.delete.cancel')}
          </Button>
          <Button variant="danger" disabled={isPending} onClick={() => confirmDelete()}>
            {t('library.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
