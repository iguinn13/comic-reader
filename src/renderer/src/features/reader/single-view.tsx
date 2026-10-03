import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepZoom } from './zoom'
const WHEEL_PAGE_COOLDOWN_MS = 250
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
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const imageLoaded = page !== undefined && loadedUrl === page.url
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
    const rect = event.currentTarget.getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    if (xRatio < 1 / 3) prev()
    else if (xRatio > 2 / 3) next()
    else if (isFullscreen) setChromeVisible(!chromeVisible)
  }
  function handleDoubleClick(): void {
    setPrefs({ zoom: zoom === 1 ? 2 : 1 })
  }
  if (source.kind === 'images' && !page) return null
  if (currentPage < 0 || currentPage >= pageCount) return null
  const pageClassName = cn(
    'mx-auto select-none transition-transform duration-150 ease-out',
    fit === 'height' && 'h-full w-auto',
    fit === 'width' && 'h-auto w-full',
    fit === 'original' && 'h-auto w-auto max-w-none',
  )
  const pageStyle: React.CSSProperties = {
    transform: `scale(${zoom})`,
    transformOrigin: 'top center',
  }
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'absolute inset-0 overflow-auto bg-reader-bg text-center',
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
