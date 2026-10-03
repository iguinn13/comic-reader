import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleDashed, Heart, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { toast } from '@renderer/stores/toast-store'
import { useSelectionStore } from '@renderer/stores/selection-store'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
export function SelectionBar(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const selectedIds = useSelectionStore((state) => Array.from(state.selectedIds))
  const clearSelection = useSelectionStore((state) => state.clear)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const invalidateLibrary = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
  }
  const { mutate: setReadStatus } = useMutation({
    mutationFn: (status: 'read' | 'unread') => api.library.setReadStatus(selectedIds, status),
    onSuccess: (_result, status) => {
      invalidateLibrary()
      toast(
        t(status === 'read' ? 'toast.selectionRead' : 'toast.selectionUnread', {
          count: selectedIds.length,
        }),
      )
    },
  })
  const { mutate: favoriteSelected } = useMutation({
    mutationFn: () => api.library.setFavorite(selectedIds, true),
    onSuccess: invalidateLibrary,
  })
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-sm font-medium text-text">
        {t('library.selectionBar.count', { count: selectedIds.length })}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setReadStatus('read')}>
          <CheckCircle2 className="size-4" />
          {t('library.selectionBar.markRead')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setReadStatus('unread')}>
          <CircleDashed className="size-4" />
          {t('library.selectionBar.markUnread')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => favoriteSelected()}>
          <Heart className="size-4" />
          {t('library.selectionBar.favorite')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          {t('library.selectionBar.delete')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearSelection}
          aria-label={t('library.selectionBar.clear')}
        >
          <X className="size-4" />
        </Button>
      </div>

      <ConfirmDeleteDialog
        comicIds={selectedIds}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={clearSelection}
      />
    </div>
  )
}
