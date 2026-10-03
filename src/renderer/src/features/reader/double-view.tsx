import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { computeSpreads, type SpreadDims } from './compute-spreads'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepZoom } from './zoom'
const WHEEL_PAGE_COOLDOWN_MS = 250
const PRELOAD_AHEAD = 3
const PRELOAD_BEHIND = 1
export function DoubleView({
  source,
  pageCount,
}: {
  source: ReaderSource
  pageCount: number
}): React.JSX.Element | null {
  const currentPage = useReaderStore((s) => s.currentPage)
  const fit = useReaderStore((s) => s.prefs.fit)
  const zoom = useReaderStore((s) => s.prefs.zoom)
  const doubleOffset = useReaderStore((s) => s.prefs.doubleOffset)
  const chromeVisible = useReaderStore((s) => s.chromeVisible)
  const isFullscreen = useReaderStore((s) => s.isFullscreen)
  const showChrome = useShowChrome()
  const next = useReaderStore((s) => s.next)
  const prev = useReaderStore((s) => s.prev)
  const setChromeVisible = useReaderStore((s) => s.setChromeVisible)
  const setPrefs = useReaderStore((s) => s.setPrefs)
  const pdfPageSizes = useReaderStore((s) => s.pdfPageSizes)
  const reportPdfPageSize = useReaderStore((s) => s.reportPdfPageSize)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastWheelPageChangeRef = useRef(0)
  const pdfDoc = usePdfDocument(source.kind === 'pdf' ? source.fileUrl : null)
  const dims: SpreadDims[] =
    source.kind === 'images'
      ? source.pages
      : Array.from({ length: pageCount }, (_, index) => ({
          width: pdfPageSizes[index]?.width ?? null,
          height: pdfPageSizes[index]?.height ?? null,
        }))
  const spreads = computeSpreads(dims, doubleOffset)
  const spreadIndex = spreads.findIndex((spread) => spread.includes(currentPage))
  const spread = spreads[spreadIndex] ?? spreads[0]
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set())
  const isLoaded = (pageIndex: number): boolean => loadedKeys.has(`${spreadIndex}:${pageIndex}`)
  const markLoaded = (pageIndex: number): void =>
    setLoadedKeys((prev) => new Set(prev).add(`${spreadIndex}:${pageIndex}`))
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [currentPage])
  useEffect(() => {
    if (source.kind !== 'images') return
    const pages = source.pages
    const spreadsToPreload = [
      ...Array.from({ length: PRELOAD_AHEAD }, (_, i) => spreadIndex + 1 + i),
      ...Array.from({ length: PRELOAD_BEHIND }, (_, i) => spreadIndex - 1 - i),
    ].filter((i) => i >= 0 && i < spreads.length)
    for (const i of spreadsToPreload) {
      for (const pageIndex of spreads[i]) {
        const image = new Image()
        image.src = pages[pageIndex].url
      }
    }
  }, [spreadIndex, spreads, source])
  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    if (event.ctrlKey) {
      event.preventDefault()
      setPrefs({ zoom: stepZoom(zoom, event.deltaY < 0 ? 1 : -1) })
      return
    }
    const el = scrollRef.current
    if (!el) return
    const overflowsVertically = el.scrollHeight > el.clientHeight + 1
    const now = Date.now()
    if (now - lastWheelPageChangeRef.current < WHEEL_PAGE_COOLDOWN_MS) return
    if (!overflowsVertically) {
      lastWheelPageChangeRef.current = now
      if (event.deltaY > 0) next()
      else prev()
      return
    }
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const atTop = el.scrollTop <= 0
    if (event.deltaY > 0 && atBottom) {
      lastWheelPageChangeRef.current = now
      next()
    } else if (event.deltaY < 0 && atTop) {
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
  if (!spread) return null
  const imageStyle: React.CSSProperties =
    fit === 'height'
      ? { height: '100%', width: 'auto' }
      : fit === 'width'
        ? { height: 'auto', width: spread.length === 2 ? '50%' : '100%' }
        : { height: 'auto', width: 'auto', maxWidth: 'none' }
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'absolute inset-0 flex items-start justify-center overflow-auto bg-reader-bg',
        !showChrome && 'scrollbar-hidden',
      )}
    >
      {source.kind === 'images' && spread.some((pageIndex) => !isLoaded(pageIndex)) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-text-muted" />
        </div>
      )}
      <div
        className="flex h-full w-full justify-center"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
      >
        {spread.map((pageIndex) =>
          source.kind === 'images' ? (
            <img
              key={pageIndex}
              src={source.pages[pageIndex].url}
              alt=""
              draggable={false}
              decoding="async"
              style={imageStyle}
              className={cn('select-none', !isLoaded(pageIndex) && 'invisible')}
              onLoad={() => markLoaded(pageIndex)}
              onError={() => markLoaded(pageIndex)}
            />
          ) : (
            <PdfPage
              key={pageIndex}
              doc={pdfDoc}
              pageIndex={pageIndex}
              style={imageStyle}
              className="select-none"
              onMeasured={reportPdfPageSize}
            />
          ),
        )}
      </div>
    </div>
  )
}
