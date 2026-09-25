import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useLibraryChangedSubscription } from '@renderer/features/library/use-library-changed-subscription'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { useUiStore } from '@renderer/stores/ui-store'
import { Sidebar } from './sidebar'

/** Abaixo disso a sidebar recolhe sozinha, sem sobrescrever a preferência salva (docs/07-ui-ux.md §3). */
const NARROW_WINDOW_BREAKPOINT = 1100

/**
 * Layout raiz (RF-60): sidebar fixa à esquerda + a tela da rota atual à
 * direita. A preferência de recolher/expandir vive em
 * `settings['ui.sidebarCollapsed']`; o recolhimento automático por largura de
 * janela é só visual e nunca é gravado.
 */
export function AppShell(): React.JSX.Element {
  const { t } = useTranslation()
  useLibraryChangedSubscription()

  const queryClient = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all(),
    queryFn: api.settings.get,
  })

  const sidebarCollapsedPref = useUiStore((state) => state.sidebarCollapsedPref)
  const setSidebarCollapsedPref = useUiStore((state) => state.setSidebarCollapsedPref)
  const isWindowNarrow = useUiStore((state) => state.isWindowNarrow)
  const setIsWindowNarrow = useUiStore((state) => state.setIsWindowNarrow)

  useEffect(() => {
    if (settings) setSidebarCollapsedPref(settings['ui.sidebarCollapsed'])
  }, [settings, setSidebarCollapsedPref])

  const { mutate: persistCollapsed } = useMutation({
    mutationFn: (collapsed: boolean) => api.settings.update({ 'ui.sidebarCollapsed': collapsed }),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.settings.all(), updated),
  })

  useEffect(() => {
    function handleResize(): void {
      setIsWindowNarrow(window.innerWidth < NARROW_WINDOW_BREAKPOINT)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setIsWindowNarrow])

  function toggleCollapsed(): void {
    const next = !sidebarCollapsedPref
    setSidebarCollapsedPref(next)
    persistCollapsed(next)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setSidebarCollapsedPref(!sidebarCollapsedPref)
        persistCollapsed(!sidebarCollapsedPref)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarCollapsedPref, setSidebarCollapsedPref, persistCollapsed])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-sm focus:text-accent-fg"
      >
        {t('common.skipToContent')}
      </a>
      {/* Faixa arrastável no topo (titleBarStyle 'hidden'); deixa livre a área dos botões nativos. */}
      <div aria-hidden className="app-drag fixed inset-x-0 top-0 z-40 h-2 pr-36" />
      <Sidebar
        collapsed={sidebarCollapsedPref || isWindowNarrow}
        onToggleCollapsed={toggleCollapsed}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-0 min-w-0 flex-1 overflow-hidden focus:outline-none"
      >
        <Outlet />
      </main>
    </div>
  )
}
