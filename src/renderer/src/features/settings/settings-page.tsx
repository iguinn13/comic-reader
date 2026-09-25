import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { ShortcutsTable } from '@renderer/features/reader/shortcuts'
import { api } from '@renderer/lib/api'
import { formatBytes } from '@renderer/lib/format'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import { CACHE_MAX_BYTES, CACHE_MIN_BYTES } from '@shared/constants'
import type { FitMode, ReaderMode, ReaderPrefs } from '@shared/types'

const GB = 1024 * 1024 * 1024
const MODES: ReaderMode[] = ['single', 'double', 'vertical']
const FITS: FitMode[] = ['height', 'width', 'original']

/** Tela Configurações (RF-50..53, docs/07-ui-ux.md §4.8): coluna única, máx. 720 px. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmApplyAll, setConfirmApplyAll] = useState(false)

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all(),
    queryFn: api.settings.get,
  })
  const { data: stats } = useQuery({
    queryKey: queryKeys.library.stats(),
    queryFn: api.library.stats,
  })
  const { data: info } = useQuery({ queryKey: queryKeys.app.info(), queryFn: api.app.info })

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.stats() })
  }

  const update = useMutation({
    mutationFn: api.settings.update,
    onSuccess: refresh,
  })
  const applyAll = useMutation({
    mutationFn: api.settings.resetAllReaderPrefs,
    onSuccess: () => setConfirmApplyAll(false),
  })
  const clearCache = useMutation({ mutationFn: api.app.clearCache, onSuccess: refresh })

  if (!settings) return <div className="h-full p-8" />

  const defaults = settings['reader.defaults']
  const setDefaults = (patch: Partial<ReaderPrefs>): void =>
    update.mutate({ 'reader.defaults': { ...defaults, ...patch } })
  const maxBytes = settings['cache.maxBytes']
  const cachePercent = stats ? Math.min(100, (stats.cacheBytes / maxBytes) * 100) : 0

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto flex max-w-180 flex-col gap-10">
        <h1 className="text-2xl font-semibold text-text">{t('nav.settings')}</h1>

        <Section title={t('settings.reading.title')}>
          <Field label={t('settings.reading.mode')}>
            <Segmented
              options={MODES}
              value={defaults.mode}
              label={(option) => t(`reader.mode.${option}`)}
              onChange={(mode) => setDefaults({ mode })}
            />
          </Field>
          <Field label={t('settings.reading.fit')}>
            <Segmented
              options={FITS}
              value={defaults.fit}
              label={(option) => t(`reader.fit.${option}`)}
              onChange={(fit) => setDefaults({ fit })}
            />
          </Field>
          <Field label={t('settings.reading.verticalWidth')}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={Math.round(defaults.verticalWidth * 100)}
                aria-label={t('settings.reading.verticalWidth')}
                onChange={(event) =>
                  setDefaults({ verticalWidth: Number(event.target.value) / 100 })
                }
                className="w-56 accent-accent"
              />
              <span className="w-10 text-sm tabular-nums text-text-muted">
                {Math.round(defaults.verticalWidth * 100)}%
              </span>
            </div>
          </Field>
          <div>
            <Button variant="outline" onClick={() => setConfirmApplyAll(true)}>
              {t('settings.reading.applyAll')}
            </Button>
          </div>
        </Section>

        <Section title={t('settings.storage.title')}>
          <p className="text-sm text-text-muted">
            {stats
              ? t('settings.storage.library', {
                  count: stats.comicCount,
                  size: formatBytes(stats.libraryBytes),
                })
              : '…'}
          </p>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-text-muted">
              {stats
                ? t('settings.storage.cache', {
                    used: formatBytes(stats.cacheBytes),
                    max: formatBytes(maxBytes),
                  })
                : '…'}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${cachePercent}%` }} />
            </div>
          </div>
          <Field label={t('settings.storage.limit')}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={CACHE_MIN_BYTES / GB}
                max={CACHE_MAX_BYTES / GB}
                step={0.5}
                value={maxBytes / GB}
                aria-label={t('settings.storage.limit')}
                onChange={(event) =>
                  update.mutate({ 'cache.maxBytes': Math.round(Number(event.target.value) * GB) })
                }
                className="w-56 accent-accent"
              />
              <span className="w-16 text-sm tabular-nums text-text-muted">
                {formatBytes(maxBytes)}
              </span>
            </div>
          </Field>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={clearCache.isPending}
              onClick={() => clearCache.mutate()}
            >
              {t('settings.storage.clearCache')}
            </Button>
            <Button variant="outline" onClick={() => void api.app.openDataFolder()}>
              {t('settings.storage.openFolder')}
            </Button>
          </div>
          {clearCache.data && (
            <p role="status" className="text-sm text-text-muted">
              {t('settings.storage.cleared', { size: formatBytes(clearCache.data.freedBytes) })}
            </p>
          )}
        </Section>

        <Section title={t('settings.shortcuts.title')}>
          <ShortcutsTable />
        </Section>

        <Section title={t('settings.about.title')}>
          <p className="text-sm text-text-muted">
            {t('settings.about.version', { version: info?.version ?? '' })}
          </p>
          <p className="break-all text-sm text-text-muted">
            {t('settings.about.dataPath', { path: info?.userDataPath ?? '' })}
          </p>
        </Section>
      </div>

      <Dialog open={confirmApplyAll} onOpenChange={setConfirmApplyAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.reading.applyAllTitle')}</DialogTitle>
            <DialogDescription>{t('settings.reading.applyAllDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmApplyAll(false)}>
              {t('collections.dialog.cancel')}
            </Button>
            <Button disabled={applyAll.isPending} onClick={() => applyAll.mutate()}>
              {t('settings.reading.applyAllConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border pb-2 text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-text-muted">{label}</span>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: T[]
  value: T
  label: (option: T) => string
  onChange: (option: T) => void
}): React.JSX.Element {
  return (
    <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded px-3 py-1 text-sm transition-colors duration-150 ease-out',
            value === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
          )}
        >
          {label(option)}
        </button>
      ))}
    </div>
  )
}
