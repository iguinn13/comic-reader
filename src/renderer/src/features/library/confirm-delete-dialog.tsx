import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
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
 * (1 HQ) quanto a barra de seleção (N HQs). Por padrão só remove do índice —
 * os arquivos ficam nas pastas do usuário (docs/10 ADR); "apagar também o
 * arquivo do disco" é opt-in explícito.
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
  const [deleteFile, setDeleteFile] = useState(false)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  function handleOpenChange(next: boolean): void {
    if (!next) setDeleteFile(false)
    onOpenChange(next)
  }

  const { mutate: confirmDelete, isPending } = useMutation({
    mutationFn: () => api.library.delete(comicIds, { deleteFile }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
      handleOpenChange(false)
      onDeleted?.()
    },
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('library.delete.title', { count: comicIds.length })}</DialogTitle>
          <DialogDescription>{t('library.delete.description')}</DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 text-sm text-text">
          <Checkbox checked={deleteFile} onCheckedChange={(value) => setDeleteFile(!!value)} />
          {t('library.delete.alsoDeleteFile')}
        </label>

        <DialogFooter>
          <Button ref={cancelRef} variant="outline" onClick={() => handleOpenChange(false)}>
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
