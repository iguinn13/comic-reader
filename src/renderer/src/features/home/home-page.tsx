import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@renderer/components/empty-state'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
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
    !isLoading && data && data.continueReading.length === 0 && data.recentlyAdded.length === 0

  async function handleAddFolder(): Promise<void> {
    const folder = await api.libraryFolders.add()
    if (folder) await api.library.scan()
  }

  if (isLoading || !data) return <div className="h-full p-8" />

  if (isEmpty) {
    return (
      <div className="h-full p-8">
        <EmptyState
          title={t('emptyState.library.title')}
          description={t('emptyState.library.description')}
          action={
            <Button onClick={() => void handleAddFolder()}>{t('emptyState.library.action')}</Button>
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
        viewAllHref="/library?view=flat&status=reading&sort=lastReadAt"
        comics={data.continueReading}
      />

      <ComicRail
        title={t('home.recentlyAdded')}
        viewAllHref="/library?view=flat"
        comics={data.recentlyAdded}
      />
    </div>
  )
}
