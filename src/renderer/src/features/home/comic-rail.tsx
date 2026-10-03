import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ComicCard } from '@renderer/features/library/comic-card'
import type { ComicSummary } from '@shared/types'
export function ComicRail({
  title,
  viewAllHref,
  comics,
}: {
  title: string
  viewAllHref?: string
  comics: ComicSummary[]
}): React.JSX.Element | null {
  const { t } = useTranslation()
  if (comics.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-sm text-accent hover:underline">
            {t('home.viewAll')}
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hidden p-2">
        {comics.map((comic) => (
          <div key={comic.id} className="w-48 shrink-0">
            <ComicCard comic={comic} />
          </div>
        ))}
      </div>
    </section>
  )
}
