import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@renderer/lib/utils'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepVerticalWidth } from './zoom'
const FALLBACK_ASPECT_RATIO = 1.5
const SCROLL_THROTTLE_MS = 150
function releaseImageOnUnmount(img: HTMLImageElement | null): (() => void) | void {
  if (!img) return
  return () => {
    img.removeAttribute('src')
  }
}
export function VerticalView({
  source,
  pageCount,
}: {
  source: ReaderSource
  pageCount: number
}): React.JSX.Element | null {
  const currentPage = useReaderStore((s) => s.currentPage)
  const verticalWidth = useReaderStore((s) => s.prefs.verticalWidth)
  const chromeVisible = useReaderStore((s) => s.chromeVisible)
  const isFullscreen = useReaderStore((s) => s.isFullscreen)
  const showChrome = useShowChrome()
  const goTo = useReaderStore((s) => s.goTo)
  const setChromeVisible = useReaderStore((s) => s.setChromeVisible)
  const setPrefs = useReaderStore((s) => s.setPrefs)
  const pdfPageSizes = useReaderStore((s) => s.pdfPageSizes)
  const reportPdfPageSize = useReaderStore((s) => s.reportPdfPageSize)
  const pdfDoc = usePdfDocument(source.kind === 'pdf' ? source.fileUrl : null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const hasScrolledToInitialRef = useRef(false)
  const lastReportedPageRef = useRef(currentPage)
  const measureRef = useCallback((node: HTMLDivElement | null): (() => void) | void => {
    scrollRef.current = node
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(node)
    setContainerWidth(node.clientWidth)
    return () => observer.disconnect()
  }, [])
  const columnWidth = containerWidth * verticalWidth
  const rowVirtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const dims = source.kind === 'images' ? source.pages[index] : pdfPageSizes[index]
      const ratio = dims?.width && dims.height ? dims.height / dims.width : FALLBACK_ASPECT_RATIO
      return Math.max(1, columnWidth * ratio)
    },
    overscan: 1,
    enabled: containerWidth > 0,
  })
  useEffect(() => {
    rowVirtualizer.measure()
  }, [columnWidth, pdfPageSizes, rowVirtualizer])
  useEffect(() => {
    if (hasScrolledToInitialRef.current || containerWidth === 0) return
    hasScrolledToInitialRef.current = true
    rowVirtualizer.scrollToIndex(currentPage, { align: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on the first measurement, not on every scroll
  }, [containerWidth])
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let lastRun = 0
    function handleScroll(): void {
      if (!hasScrolledToInitialRef.current) return
      const now = Date.now()
      if (now - lastRun < SCROLL_THROTTLE_MS) return
      lastRun = now
      const line = el!.scrollTop + el!.clientHeight / 3
      const match = rowVirtualizer
        .getVirtualItems()
        .find((item) => item.start <= line && line < item.start + item.size)
      if (match && match.index !== currentPage) {
        lastReportedPageRef.current = match.index
        goTo(match.index)
      }
    }
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [rowVirtualizer, currentPage, goTo])
  useEffect(() => {
    if (!hasScrolledToInitialRef.current) return
    if (lastReportedPageRef.current === currentPage) return
    lastReportedPageRef.current = currentPage
    rowVirtualizer.scrollToIndex(currentPage, { align: 'start' })
  }, [currentPage, rowVirtualizer])
  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey) return
    event.preventDefault()
    setPrefs({ verticalWidth: stepVerticalWidth(verticalWidth, event.deltaY < 0 ? 1 : -1) })
  }
  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    if (xRatio >= 1 / 3 && xRatio <= 2 / 3 && isFullscreen) {
      setChromeVisible(!chromeVisible)
    }
  }
  if (pageCount === 0) return null
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={measureRef}
      onWheel={handleWheel}
      onClick={handleClick}
      className={cn(
        'absolute inset-0 overflow-auto scrollbar-hidden bg-reader-bg',
        !showChrome && 'scrollbar-hidden',
      )}
    >
      {containerWidth > 0 && (
        <div
          className="relative mx-auto"
          style={{ height: rowVirtualizer.getTotalSize(), width: columnWidth }}
        >
          {rowVirtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              ref={source.kind === 'pdf' ? rowVirtualizer.measureElement : undefined}
              data-index={item.index}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {source.kind === 'images' ? (
                <img
                  src={source.pages[item.index].url}
                  alt=""
                  draggable={false}
                  decoding="async"
                  loading="eager"
                  ref={releaseImageOnUnmount}
                  className="w-full select-none"
                />
              ) : (
                <PdfPage
                  doc={pdfDoc}
                  pageIndex={item.index}
                  className="w-full select-none"
                  onMeasured={reportPdfPageSize}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
