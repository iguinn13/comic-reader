import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Heart, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { cn } from '@renderer/lib/utils'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { toast } from '@renderer/stores/toast-store'
import { useSelectionStore } from '@renderer/stores/selection-store'
import type { ComicSummary } from '@shared/types'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { RenameDialog } from './rename-dialog'

/**
 * Card de HQ (docs/07-ui-ux.md §4.3): capa, favoritar (RF-15), seleção
 * múltipla via checkbox/Ctrl-Shift+clique (RF-18), e o menu de contexto com
 * marcar lida/não lida (RF-14), renomear (RF-16) e excluir (RF-17).
 */
export function ComicCard({ comic }: { comic: ComicSummary }): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isSelected = useSelectionStore((state) => state.selectedIds.has(comic.id))
  const selectedCount = useSelectionStore((state) => state.selectedIds.size)
  const hasSelection = selectedCount > 0
  // Menu de contexto num card que faz parte de uma seleção múltipla age em todos os selecionados.
  const isMultiTarget = isSelected && selectedCount > 1
  const targetIds = (): string[] =>
    isMultiTarget ? Array.from(useSelectionStore.getState().selectedIds) : [comic.id]
  const toggleSelected = useSelectionStore((state) => state.toggle)

  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteIds, setDeleteIds] = useState<string[]>([comic.id])

  const invalidateLibrary = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
  }

  const { mutate: toggleFavorite, isPending: isTogglingFavorite } = useMutation({
    mutationFn: (value: boolean) => api.library.setFavorite(targetIds(), value),
    onSuccess: invalidateLibrary,
  })

  const { mutate: setReadStatus } = useMutation({
    mutationFn: (status: 'read' | 'unread') => api.library.setReadStatus(targetIds(), status),
    onSuccess: (_result, status) => {
      invalidateLibrary()
      if (isMultiTarget) {
        toast(
          t(status === 'read' ? 'toast.selectionRead' : 'toast.selectionUnread', {
            count: selectedCount,
          }),
        )
        return
      }
      // Guarda o estado anterior para o Desfazer devolver também a página.
      const previous = { status: comic.status, page: comic.currentPage }
      toast(t(status === 'read' ? 'toast.markedRead' : 'toast.markedUnread'), {
        label: t('toast.undo'),
        run: () => {
          void api.library
            .setReadStatus([comic.id], previous.status === 'read' ? 'read' : 'unread')
            .then(() => {
              if (previous.status === 'reading') api.reader.setPage(comic.id, previous.page)
              invalidateLibrary()
            })
        },
      })
    },
  })

  const statusLabel =
    comic.status === 'read'
      ? t('library.readBadge')
      : comic.status === 'reading'
        ? t('library.pageOf', { current: comic.currentPage + 1, total: comic.pageCount })
        : t('library.unreadBadge')

  function handleActivate(event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || hasSelection) {
      toggleSelected(comic.id)
      return
    }
    void navigate(`/read/${comic.id}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={comic.title}
            onClick={handleActivate}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                void navigate(`/read/${comic.id}`)
              }
            }}
            className={cn(
              'group relative aspect-2/3 cursor-pointer overflow-hidden rounded-lg bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              isSelected && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
            )}
          >
            {comic.coverUrl ? (
              <img
                src={comic.coverUrl}
                alt=""
                loading="lazy"
                className={cn(
                  'size-full object-cover transition duration-150 ease-out group-hover:scale-[1.03]',
                  comic.status === 'read' && 'opacity-50 saturate-50 group-hover:opacity-100',
                )}
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-linear-to-b from-surface-2 to-surface p-3 text-center text-xs text-text-subtle">
                {comic.title}
              </div>
            )}

            <div
              className={cn(
                'absolute left-2 top-2 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-within:opacity-100',
                (isSelected || hasSelection) && 'opacity-100',
              )}
            >
              <Checkbox
                checked={isSelected}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={() => toggleSelected(comic.id)}
              />
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                toggleFavorite(!comic.isFavorite)
              }}
              disabled={isTogglingFavorite}
              aria-pressed={comic.isFavorite}
              aria-label={t('library.favoritesOnly')}
              className={cn(
                'absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-bg/60 text-text opacity-0 backdrop-blur transition-opacity duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100',
                comic.isFavorite && 'opacity-100',
              )}
            >
              <Heart className={cn('size-4', comic.isFavorite && 'fill-danger text-danger')} />
            </button>

            <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-fg">
                <Play className="size-5 fill-current" />
              </span>
            </span>

            {comic.status === 'read' && (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-medium text-black"
              >
                <Check className="size-3" strokeWidth={3} />
                {t('library.readBadge')}
              </span>
            )}

            {comic.status === 'reading' && (
              <div
                role="progressbar"
                aria-valuenow={Math.round(comic.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="absolute inset-x-0 bottom-0 h-0.75 bg-black/40"
              >
                <div className="h-full bg-accent" style={{ width: `${comic.progress * 100}%` }} />
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onSelect={() => toggleFavorite(!comic.isFavorite)}>
            {t(
              comic.isFavorite ? 'library.contextMenu.unfavorite' : 'library.contextMenu.favorite',
            )}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => setReadStatus(comic.status === 'read' ? 'unread' : 'read')}
          >
            {t(
              comic.status === 'read'
                ? 'library.contextMenu.markUnread'
                : 'library.contextMenu.markRead',
            )}
          </ContextMenuItem>
          {!isMultiTarget && comic.status !== 'unread' && (
            <ContextMenuItem onSelect={() => setReadStatus('unread')}>
              <RotateCcw className="size-4" />
              {t('library.contextMenu.resetProgress')}
            </ContextMenuItem>
          )}
          {!isMultiTarget && (
            <ContextMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              {t('library.contextMenu.rename')}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            danger
            onSelect={() => {
              setDeleteIds(targetIds())
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="size-4" />
            {t('library.contextMenu.delete')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-tight text-text">
          {comic.title}
        </p>
        <p
          className={cn(
            'text-xs text-text-muted',
            comic.status === 'read' && 'text-success',
            comic.status === 'reading' && 'text-accent',
          )}
        >
          {statusLabel}
        </p>
      </div>

      <RenameDialog
        comicId={comic.id}
        initialTitle={comic.title}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
      <ConfirmDeleteDialog
        comicIds={deleteIds}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={isMultiTarget ? () => useSelectionStore.getState().clear() : undefined}
      />
    </div>
  )
}
