import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Clock, Copy, Loader2, Minus, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { useImportStore } from '@renderer/stores/import-store'
import { importErrorMessageKey } from './import-errors'
import { DuplicateDialog } from './duplicate-dialog'
import type { ImportItem, ImportItemStatus } from '@shared/types'

/** Tempo em que o painel fecha sozinho ao terminar sem erros/duplicatas (docs/05 §6). */
const AUTO_CLOSE_DELAY_MS = 4000

const STATUS_ICON: Record<ImportItemStatus, React.JSX.Element> = {
  queued: <Clock className="size-4 text-text-subtle" />,
  processing: <Loader2 className="size-4 animate-spin text-accent" />,
  'awaiting-duplicate-decision': <Copy className="size-4 text-text-muted" />,
  done: <Check className="size-4 text-success" />,
  'skipped-duplicate': <Copy className="size-4 text-text-muted" />,
  failed: <AlertTriangle className="size-4 text-danger" />,
  cancelled: <X className="size-4 text-text-subtle" />,
}

/**
 * Cartão flutuante de importação no canto inferior direito
 * (docs/07-ui-ux.md §4.6, docs/05-importacao.md §6). Só é renderizado quando
 * há um `ImportJobState` no store; some sozinho quando o usuário fecha, ou
 * automaticamente 4s após terminar sem erros nem duplicatas.
 */
export function ImportPanel(): React.JSX.Element | null {
  const { t } = useTranslation()
  const job = useImportStore((state) => state.job)
  const isMinimized = useImportStore((state) => state.isMinimized)
  const toggleMinimized = useImportStore((state) => state.toggleMinimized)
  const setJob = useImportStore((state) => state.setJob)

  const isFinished = job?.status === 'finished'
  const hasErrorsOrDuplicates = (job?.counts.failed ?? 0) > 0 || (job?.counts.skipped ?? 0) > 0

  useEffect(() => {
    if (!isFinished || hasErrorsOrDuplicates) return undefined
    const timer = setTimeout(() => setJob(null), AUTO_CLOSE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isFinished, hasErrorsOrDuplicates, job?.jobId, setJob])

  if (!job) return null

  const awaitingItem = job.items.find((item) => item.status === 'awaiting-duplicate-decision')
  const processedCount = job.counts.done + job.counts.skipped + job.counts.failed

  async function handleCancel(): Promise<void> {
    if (!job) return
    await api.importer.cancel(job.jobId)
  }

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={toggleMinimized}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-text shadow-lg transition-colors duration-150 ease-out hover:bg-surface"
      >
        <Loader2 className={cn('size-4 text-accent', !isFinished && 'animate-spin')} />
        {t('import.panel.pill', { done: processedCount, total: job.counts.total })}
      </button>
    )
  }

  return (
    <>
      {job.status === 'paused-for-decision' && awaitingItem ? (
        <DuplicateDialog jobId={job.jobId} item={awaitingItem} />
      ) : null}

      <div className="fixed bottom-4 right-4 z-40 flex w-[360px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-text">
            {isFinished
              ? t('import.panel.finishedTitle')
              : t('import.panel.title', { done: processedCount, total: job.counts.total })}
          </p>
          <div className="flex items-center gap-1">
            {!isFinished ? (
              <button
                type="button"
                onClick={toggleMinimized}
                aria-label={t('import.panel.minimize')}
                className="rounded-md p-1 text-text-subtle transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text"
              >
                <Minus className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <ul className="max-h-64 space-y-0.5 overflow-y-auto px-2 py-2">
          {job.items.map((item) => (
            <ImportItemRow key={item.id} item={item} />
          ))}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          {isFinished ? (
            <>
              <p className="mr-auto text-xs text-text-muted">
                {t('import.summary.text', {
                  done: job.counts.done,
                  skipped: job.counts.skipped,
                  failed: job.counts.failed,
                })}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setJob(null)}>
                {t('import.panel.close')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void handleCancel()}>
              {t('import.panel.cancel')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function ImportItemRow({ item }: { item: ImportItem }): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <li className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-text">{item.sourceName}</span>
        {item.status === 'failed' ? (
          <span className="block truncate text-xs text-danger">
            {t(importErrorMessageKey(item.errorCode))}
          </span>
        ) : null}
      </span>
    </li>
  )
}
