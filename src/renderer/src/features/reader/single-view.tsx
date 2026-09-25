import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepZoom } from './zoom'

/** Cooldown entre trocas de página por roda quando a página cabe inteira (docs/06 §4.1). */
const WHEEL_PAGE_COOLDOWN_MS = 250
/** Preload (docs/06 §7): 3 próximas + 1 anterior. Só se aplica a imagens — PDF renderiza sob demanda. */
const PRELOAD_AHEAD = 3
const PRELOAD_BEHIND = 1

export function SingleView({
  source,
  pageCount,
}: {
  source: ReaderSource
  pageCount: number
}): React.JSX.Element | null {
  const currentPage = useReaderStore((s) => s.currentPage)
  const fit = useReaderStore((s) => s.prefs.fit)
  const zoom = useReaderStore((s) => s.prefs.zoom)
  const chromeVisible = useReaderStore((s) => s.chromeVisible)
  const isFullscreen = useReaderStore((s) => s.isFullscreen)
  const focusMode = useReaderStore((s) => s.focusMode)
  const showChrome = useShowChrome()
  const next = useReaderStore((s) => s.next)
  const prev = useReaderStore((s) => s.prev)
  const setChromeVisible = useReaderStore((s) => s.setChromeVisible)
  const setPrefs = useReaderStore((s) => s.setPrefs)
  const reportPdfPageSize = useReaderStore((s) => s.reportPdfPageSize)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastWheelPageChangeRef = useRef(0)

  const pdfDoc = usePdfDocument(source.kind === 'pdf' ? source.fileUrl : null)
  const page = source.kind === 'images' ? source.pages[currentPage] : undefined

  // A extração da página sob demanda (page-cache-service) pode levar um
  // tempo perceptível na primeira leitura de uma HQ — sem isso, a tela fica
  // em branco parecendo travada (docs/06-leitor.md §3.1). Guarda a última URL
  // carregada em vez de um booleano resetado por efeito: comparar com
  // `page.url` já reflete "ainda não carregou esta página" na primeira
  // renderização após trocar de página, sem precisar de um Effect.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const imageLoaded = page !== undefined && loadedUrl === page.url

  // docs §3.1: ao trocar de página, a rolagem volta ao topo — o fit/zoom se mantém.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [currentPage])

  useEffect(() => {
    if (source.kind !== 'images') return
    const pages = source.pages
    const toPreload = [
      ...Array.from({ length: PRELOAD_AHEAD }, (_, i) => currentPage + 1 + i),
      ...Array.from({ length: PRELOAD_BEHIND }, (_, i) => currentPage - 1 - i),
    ].filter((index) => index >= 0 && index < pages.length)

    for (const index of toPreload) {
      const image = new Image()
      image.src = pages[index].url
    }
  }, [currentPage, source])

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    if (event.ctrlKey) {
      event.preventDefault()
      setPrefs({ zoom: stepZoom(zoom, event.deltaY < 0 ? 1 : -1) })
      return
    }

    const el = scrollRef.current
    if (!el) return
    const overflowsVertically = el.scrollHeight > el.clientHeight + 1

    if (!overflowsVertically) {
      const now = Date.now()
      if (now - lastWheelPageChangeRef.current < WHEEL_PAGE_COOLDOWN_MS) return
      lastWheelPageChangeRef.current = now
      if (event.deltaY > 0) next()
      else prev()
      return
    }

    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const atTop = el.scrollTop <= 0
    const now = Date.now()
    if (
      event.deltaY > 0 &&
      atBottom &&
      now - lastWheelPageChangeRef.current > WHEEL_PAGE_COOLDOWN_MS
    ) {
      lastWheelPageChangeRef.current = now
      next()
    } else if (
      event.deltaY < 0 &&
      atTop &&
      now - lastWheelPageChangeRef.current > WHEEL_PAGE_COOLDOWN_MS
    ) {
      lastWheelPageChangeRef.current = now
      prev()
    }
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    // Arrastar pra pan (docs §4.1: "cliques não disparam se o gesto foi um
    // arrasto") fica pra quando o zoom > 100% precisar de pan de verdade —
    // sem isso implementado ainda, todo clique é uma zona.
    const rect = event.currentTarget.getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    if (xRatio < 1 / 3) prev()
    else if (xRatio > 2 / 3) next()
    else if (isFullscreen || focusMode) setChromeVisible(!chromeVisible)
  }

  function handleDoubleClick(): void {
    setPrefs({ zoom: zoom === 1 ? 2 : 1 })
  }

  if (source.kind === 'images' && !page) return null
  if (currentPage < 0 || currentPage >= pageCount) return null

  const pageClassName = cn(
    'mx-auto select-none transition-transform duration-150 ease-out',
    // fit "altura": a imagem sempre ocupa 100% da área de leitura (sem
    // whitespace vertical a centralizar). "largura"/"original" ficam
    // alinhados ao topo em vez de centralizados verticalmente — uma
    // simplificação aceita nesta v1 do modo single.
    fit === 'height' && 'h-full w-auto',
    fit === 'width' && 'h-auto w-full',
    fit === 'original' && 'h-auto w-auto max-w-none',
  )
  const pageStyle: React.CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  }

  return (
    // Zonas de clique/roda do mouse (docs/06-leitor.md §4.1), não um controle
    // de teclado: a navegação por teclado é global (`useReaderKeyboard` na
    // rota do leitor), não depende do foco deste elemento.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'relative size-full overflow-auto bg-reader-bg text-center',
        !showChrome && 'scrollbar-hidden',
      )}
    >
      {page ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-text-muted" />
            </div>
          )}
          <img
            key={page.index}
            src={page.url}
            alt=""
            draggable={false}
            decoding="async"
            style={pageStyle}
            className={cn(pageClassName, !imageLoaded && 'invisible')}
            onLoad={() => setLoadedUrl(page.url)}
            onError={() => setLoadedUrl(page.url)}
          />
        </>
      ) : (
        <PdfPage
          key={currentPage}
          doc={pdfDoc}
          pageIndex={currentPage}
          style={pageStyle}
          className={pageClassName}
          onMeasured={reportPdfPageSize}
        />
      )}
    </div>
  )
}
