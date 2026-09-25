import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { toast } from '@renderer/stores/toast-store'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import type { CollectionDetail, ComicId } from '@shared/types'

type Item = CollectionDetail['items'][number]

/** Saga em lista numerada (RF-24, docs/07 §4.5): drag & drop (mouse e teclado) e menu Mover/Remover. */
export function SagaList({ collection }: { collection: CollectionDetail }): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const ids = collection.items.map((item) => item.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
  }
  const { mutate: reorder } = useMutation({
    mutationFn: (ordered: ComicId[]) => api.collections.reorder(collection.id, ordered),
    onSuccess: invalidate,
  })
  const { mutate: remove } = useMutation({
    mutationFn: (id: ComicId) => api.collections.removeItems(collection.id, [id]),
    onSuccess: (_result, id) => {
      invalidate()
      const originalOrder = ids
      toast(t('toast.removedFrom', { name: collection.name }), {
        label: t('toast.undo'),
        run: () => {
          // Reinsere no fim e devolve a ordem original.
          void api.collections
            .addItems(collection.id, [id])
            .then(() => api.collections.reorder(collection.id, originalOrder))
            .then(invalidate)
        },
      })
    },
  })

  function handleDragEnd({ active, over }: DragEndEvent): void {
    if (!over || active.id === over.id) return
    reorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  function move(id: ComicId, to: 'up' | 'down' | 'start' | 'end'): void {
    const from = ids.indexOf(id)
    const target = { up: from - 1, down: from + 1, start: 0, end: ids.length - 1 }[to]
    if (target < 0 || target >= ids.length || target === from) return
    reorder(arrayMove(ids, from, target))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {collection.items.map((item, index) => (
            <SagaRow
              key={item.id}
              item={item}
              number={index + 1}
              collectionId={collection.id}
              onMove={(to) => move(item.id, to)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function SagaRow({
  item,
  number,
  collectionId,
  onMove,
  onRemove,
}: {
  item: Item
  number: number
  collectionId: string
  onMove: (to: 'up' | 'down' | 'start' | 'end') => void
  onRemove: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: item.id })

  const status =
    item.status === 'read'
      ? t('library.readBadge')
      : item.status === 'reading'
        ? t('library.pageOf', { current: item.currentPage + 1, total: item.pageCount })
        : t('library.unreadBadge')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={t('collections.saga.drag')}
        className="cursor-grab touch-none rounded p-1 text-text-subtle hover:text-text"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 text-right text-sm tabular-nums text-text-muted">{number}</span>
      <button
        type="button"
        onClick={() => void navigate(`/read/${item.id}?from=${collectionId}`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" className="h-14 w-10 rounded object-cover" />
        ) : (
          <div className="h-14 w-10 rounded bg-surface-2" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text">{item.title}</span>
          <span className="block text-xs text-text-muted">{status}</span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('reader.moreActions')}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onMove('start')}>
            {t('collections.saga.moveStart')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove('up')}>
            {t('collections.saga.moveUp')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove('down')}>
            {t('collections.saga.moveDown')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove('end')}>
            {t('collections.saga.moveEnd')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRemove}>{t('collections.saga.remove')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
