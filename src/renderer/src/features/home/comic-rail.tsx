import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ComicCard } from '@renderer/features/library/comic-card'
import type { ComicSummary } from '@shared/types'

/**
 * Faixa horizontal com scroll (docs/07-ui-ux.md §4.1). Reusa o `ComicCard` da
 * Biblioteca em vez de um card dedicado maior (180px na spec) — simplificação
 * aceita nesta v1, sem mudar a leitura visual do conteúdo.
 */
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
      <div className="flex gap-4 overflow-x-auto scrollbar-hidden pb-2">
        {comics.map((comic) => (
          <div key={comic.id} className="w-48 shrink-0">
            <ComicCard comic={comic} />
          </div>
        ))}
      </div>
    </section>
  )
}
