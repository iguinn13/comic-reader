import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { CollectionCard } from '@renderer/features/collections/collection-card'
import { ComicRail } from './comic-rail'

/**
 * Tela Início (RF-11, RF-63, docs/07-ui-ux.md §4.1).
 */
export function HomePage(): React.JSX.Element {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.library.home(),
    queryFn: api.library.home,
  })

  const isEmpty =
    !isLoading &&
    data &&
    data.continueReading.length === 0 &&
    data.recentlyAdded.length === 0 &&
    data.sagasInProgress.length === 0

  async function handleImport(): Promise<void> {
    const paths = await api.importer.pickFiles()
    if (paths.length === 0) return
    await api.importer.start(paths)
  }

  if (isLoading || !data) return <div className="h-full p-8" />

  if (isEmpty) {
    return (
      <div className="h-full p-8">
        <EmptyState
          title={t('emptyState.library.title')}
          description={t('emptyState.library.description')}
          action={
            <Button onClick={() => void handleImport()}>{t('emptyState.library.action')}</Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto p-8">
      <h1 className="text-2xl font-semibold text-text">{t('home.greeting')}</h1>

      <ComicRail
        title={t('home.continueReading')}
        viewAllHref="/library?status=reading&sort=lastReadAt"
        comics={data.continueReading}
      />

      {data.sagasInProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">{t('home.sagasInProgress')}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.sagasInProgress.map((saga) => (
              <div key={saga.id} className="w-40 shrink-0">
                <CollectionCard collection={saga} />
              </div>
            ))}
          </div>
        </section>
      )}

      <ComicRail
        title={t('home.recentlyAdded')}
        viewAllHref="/library"
        comics={data.recentlyAdded}
      />
    </div>
  )
}
