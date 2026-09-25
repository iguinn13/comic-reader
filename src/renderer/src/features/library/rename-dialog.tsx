import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
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
import { TITLE_MAX_LENGTH } from '@shared/constants'
import type { ComicId } from '@shared/types'

interface RenameDialogProps {
  comicId: ComicId
  initialTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Diálogo "Renomear" (RF-16, docs/07-ui-ux.md §5). */
export function RenameDialog({
  comicId,
  initialTitle,
  open,
  onOpenChange,
}: RenameDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const { mutate: rename, isPending } = useMutation({
    mutationFn: () => api.library.rename(comicId, title.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
      onOpenChange(false)
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTitle(initialTitle)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('library.rename.title')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (title.trim()) rename()
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            {t('library.rename.label')}
            <Input
              ref={inputRef}
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('library.rename.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {t('library.rename.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
