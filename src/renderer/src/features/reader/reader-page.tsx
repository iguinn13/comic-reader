import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_READER_PREFS } from '@shared/constants'
import { AppError } from '@shared/errors'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@renderer/components/ui/button'
import { ConfirmDeleteDialog } from '@renderer/features/library/confirm-delete-dialog'
import { api } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'
import { queryKeys } from '@renderer/lib/query-keys'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import { EndPanel } from './end-panel'
import { ShortcutsDialog } from './shortcuts'
import { GoToPageDialog } from './go-to-page-dialog'
import { useReaderKeyboard, type ReaderKeyAction } from './reader-keyboard'
import { ReaderBottomBar } from './reader-bottom-bar'
import { ReaderTopBar } from './reader-top-bar'
import { DoubleView } from './double-view'
import { VerticalView } from './vertical-view'
import { SingleView } from './single-view'
import { stepVerticalWidth, stepZoom } from './zoom'

/** docs/06-leitor.md §2: as barras somem depois de 2,5 s sem movimento do mouse. */
const CHROME_AUTO_HIDE_MS = 2500

/** RF-30..44: monta a sessão de leitura e a tela real do leitor (docs/06-leitor.md). */
export function ReaderPage(): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { comicId } = useParams<{ comicId: string }>()

  const session = useReaderStore((s) => s.session)
  const currentPage = useReaderStore((s) => s.currentPage)
  const prefs = useReaderStore((s) => s.prefs)
  const showChrome = useShowChrome()
  const isFullscreen = useReaderStore((s) => s.isFullscreen)
  const endPanelOpen = useReaderStore((s) => s.endPanelOpen)
  const loadSession = useReaderStore((s) => s.loadSession)
  const goTo = useReaderStore((s) => s.goTo)
  const next = useReaderStore((s) => s.next)
  const prev = useReaderStore((s) => s.prev)
  const setPrefs = useReaderStore((s) => s.setPrefs)
  const applyPrefsFromMain = useReaderStore((s) => s.applyPrefsFromMain)
  const setChromeVisible = useReaderStore((s) => s.setChromeVisible)
  const setFullscreen = useReaderStore((s) => s.setFullscreen)
  const setEndPanelOpen = useReaderStore((s) => s.setEndPanelOpen)
  const reset = useReaderStore((s) => s.reset)

  const [goToPageOpen, setGoToPageOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reader.session(comicId ?? ''),
    queryFn: () => api.reader.open(comicId!),
    enabled: !!comicId,
    staleTime: Infinity,
    // Sem cache entre aberturas: a sessão traz a `currentPage` salva no disco, e
    // reaproveitar a de uma leitura anterior faria a HQ voltar para a página velha.
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })

  useEffect(() => {
    if (data) loadSession(data)
  }, [data, loadSession])

  const isFullscreenRef = useRef(isFullscreen)
  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  // Sai da tela: fecha a sessão no main (flush do progresso), sai da tela cheia
  // se estava nela (a tela cheia é exclusiva do leitor) e limpa o estado local.
  useEffect(() => {
    return () => {
      if (comicId) void api.reader.close(comicId)
      if (isFullscreenRef.current) void api.app.toggleFullscreen()
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve rodar na desmontagem, com o comicId da última sessão
  }, [comicId])

  useEffect(() => {
    return api.app.onFullscreenChanged(setFullscreen)
  }, [setFullscreen])

  // Auto-ocultar as barras (docs §2): só em tela cheia, após 2,5 s parado.
  useEffect(() => {
    if (!isFullscreen) {
      setChromeVisible(true)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const resetTimer = (): void => {
      setChromeVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setChromeVisible(false), CHROME_AUTO_HIDE_MS)
    }
    resetTimer()
    window.addEventListener('mousemove', resetTimer)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', resetTimer)
    }
  }, [isFullscreen, setChromeVisible])

  function handleExit(): void {
    void navigate(-1)
  }

  function toggleFavorite(value: boolean): void {
    if (!session) return
    void api.library.setFavorite([session.comic.id], value).then(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
    })
  }

  function handleResetPrefs(): void {
    if (!session) return
    void api.reader.resetPrefs(session.comic.id).then(applyPrefsFromMain)
  }

  function handleKeyAction(action: ReaderKeyAction): void {
    if (!session) return
    switch (action) {
      case 'next':
      case 'scrollDown':
        next()
        break
      case 'prev':
      case 'scrollUp':
        prev()
        break
      case 'first':
        goTo(0)
        break
      case 'last':
        goTo(session.comic.pageCount - 1)
        break
      case 'showShortcuts':
        setShortcutsOpen(true)
        break
      case 'goToPage':
        setGoToPageOpen(true)
        break
      case 'modeSingle':
        setPrefs({ mode: 'single' })
        break
      case 'modeDouble':
        setPrefs({ mode: 'double' })
        break
      case 'modeVertical':
        setPrefs({ mode: 'vertical' })
        break
      case 'toggleFit':
        setPrefs({ fit: prefs.fit === 'height' ? 'width' : 'height' })
        break
      case 'toggleDoubleOffset':
        setPrefs({ doubleOffset: !prefs.doubleOffset })
        break
      case 'zoomIn':
        if (prefs.mode === 'vertical')
          setPrefs({ verticalWidth: stepVerticalWidth(prefs.verticalWidth, 1) })
        else setPrefs({ zoom: stepZoom(prefs.zoom, 1) })
        break
      case 'zoomOut':
        if (prefs.mode === 'vertical') {
          setPrefs({ verticalWidth: stepVerticalWidth(prefs.verticalWidth, -1) })
        } else {
          setPrefs({ zoom: stepZoom(prefs.zoom, -1) })
        }
        break
      case 'zoomReset':
        if (prefs.mode === 'vertical')
          setPrefs({ verticalWidth: DEFAULT_READER_PREFS.verticalWidth })
        else setPrefs({ zoom: 1 })
        break
      case 'toggleFullscreen':
        void api.app.toggleFullscreen()
        break
      case 'toggleFavorite':
        toggleFavorite(!session.comic.isFavorite)
        break
      case 'escape':
        if (goToPageOpen) setGoToPageOpen(false)
        else if (isFullscreen) void api.app.toggleFullscreen()
        else handleExit()
        break
      case 'exit':
        handleExit()
        break
      default:
        break
    }
  }

  useReaderKeyboard(handleKeyAction)

  if (!comicId) return null

  if (isLoading) {
    return (
      <div className="flex size-full items-center justify-center bg-reader-bg text-text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    const code = error instanceof AppError ? error.code : 'INTERNAL'
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 bg-reader-bg p-8 text-center">
        <p className="max-w-sm text-sm text-text-muted">
          {code === 'FILE_MISSING' || code === 'CORRUPTED_FILE'
            ? t('errors.fileMissing')
            : t('errors.internal')}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExit}>
            {t('reader.error.back')}
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {t('reader.error.delete')}
          </Button>
        </div>
        <ConfirmDeleteDialog
          comicIds={[comicId]}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={handleExit}
        />
      </div>
    )
  }

  if (!session) return null

  return (
    <div
      className={cn(
        'flex size-full flex-col overflow-hidden bg-reader-bg',
        !showChrome && 'cursor-none',
      )}
    >
      <div
        className={cn(
          'shrink-0 transition-[opacity,transform] duration-150 ease-out',
          showChrome ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
      >
        <ReaderTopBar
          title={session.comic.title}
          mode={prefs.mode}
          fit={prefs.fit}
          zoom={prefs.zoom}
          verticalWidth={prefs.verticalWidth}
          doubleOffset={prefs.doubleOffset}
          isFavorite={session.comic.isFavorite}
          isFullscreen={isFullscreen}
          onBack={handleExit}
          onModeChange={(mode) => setPrefs({ mode })}
          onFitChange={(fit) => setPrefs({ fit })}
          onZoomChange={(zoom) => setPrefs({ zoom })}
          onVerticalWidthChange={(verticalWidth) => setPrefs({ verticalWidth })}
          onToggleDoubleOffset={() => setPrefs({ doubleOffset: !prefs.doubleOffset })}
          onToggleFavorite={() => toggleFavorite(!session.comic.isFavorite)}
          onToggleFullscreen={() => void api.app.toggleFullscreen()}
          onMarkUnread={() => void api.library.setReadStatus([session.comic.id], 'unread')}
          onResetPrefs={handleResetPrefs}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {prefs.mode === 'double' ? (
          <DoubleView source={session.source} pageCount={session.comic.pageCount} />
        ) : prefs.mode === 'vertical' ? (
          <VerticalView source={session.source} pageCount={session.comic.pageCount} />
        ) : (
          <SingleView source={session.source} pageCount={session.comic.pageCount} />
        )}
      </div>

      <div
        className={cn(
          'shrink-0 transition-[opacity,transform] duration-150 ease-out',
          showChrome ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <ReaderBottomBar
          currentPage={currentPage}
          totalPages={session.comic.pageCount}
          onGoTo={goTo}
          onPrev={prev}
          onNext={next}
          onOpenGoToPage={() => setGoToPageOpen(true)}
        />
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <GoToPageDialog
        key={goToPageOpen ? 'open' : 'closed'}
        open={goToPageOpen}
        onOpenChange={setGoToPageOpen}
        totalPages={session.comic.pageCount}
        currentPage={currentPage}
        onGoTo={goTo}
      />

      <EndPanel
        open={endPanelOpen}
        onOpenChange={setEndPanelOpen}
        comicTitle={session.comic.title}
        nextInFolder={session.nextInFolder}
        onReadNext={(nextId) => {
          setEndPanelOpen(false)
          void navigate(`/read/${nextId}`, { replace: true })
        }}
        onBackToLibrary={() => void navigate('/library')}
      />
    </div>
  )
}
