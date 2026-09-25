import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import type { CollectionSummary, CollectionType } from '@shared/types'
import { CollectionCard } from './collection-card'
import { CollectionDialog } from './collection-dialog'

/** Telas Sagas e Listas (RF-26): grade de coleções de um tipo, com ordenação por nome/atualização. */
export function CollectionsPage({ type }: { type: CollectionType }): React.JSX.Element {
  const { t } = useTranslation()
  const [sort, setSort] = useState<'name' | 'updatedAt'>('name')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CollectionSummary | undefined>()

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.collections.list(type, sort),
    queryFn: () => api.collections.list(type, sort),
  })

  const openNew = (): void => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">
          {t(`nav.${type === 'saga' ? 'sagas' : 'lists'}`)}
        </h1>
        <div className="flex items-center gap-3">
          {data.length > 1 && (
            <select
              aria-label={t('library.sortLabel')}
              value={sort}
              onChange={(event) => setSort(event.target.value as 'name' | 'updatedAt')}
              className="h-9 rounded-md border border-border bg-surface-2 px-2 text-sm text-text"
            >
              <option value="name">{t('collections.sort.name')}</option>
              <option value="updatedAt">{t('collections.sort.updatedAt')}</option>
            </select>
          )}
          <Button onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            {t(`collections.new.${type}`)}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!isLoading && data.length === 0 ? (
          <EmptyState
            title={t(`collections.empty.${type}.title`)}
            action={<Button onClick={openNew}>{t(`collections.new.${type}`)}</Button>}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
            {data.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onEdit={(target) => {
                  setEditing(target)
                  setDialogOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <CollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={type}
        collection={editing}
      />
    </div>
  )
}
