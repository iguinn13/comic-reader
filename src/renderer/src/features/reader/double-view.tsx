import { useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import { useReaderStore, useShowChrome } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { computeSpreads, type SpreadDims } from './compute-spreads'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepZoom } from './zoom'

const WHEEL_PAGE_COOLDOWN_MS = 250
/** Preload (docs/06 §7, adaptado a spreads): 3 próximos spreads + 1 anterior. Só se aplica a imagens. */
const PRELOAD_AHEAD = 3
const PRELOAD_BEHIND = 1

/**
 * Modo página dupla (docs/06-leitor.md §3.2, RF-32): monta os spreads com
 * `computeSpreads` e mostra as duas páginas lado a lado, sem gap, na mesma
 * altura. A navegação (avançar/voltar por spread) já está em
 * `reader-store.next/prev`; este componente só cuida do fit/zoom/zonas.
 */
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
  const focusMode = useReaderStore((s) => s.focusMode)
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
    else if (isFullscreen || focusMode) setChromeVisible(!chromeVisible)
  }

  function handleDoubleClick(): void {
    setPrefs({ zoom: zoom === 1 ? 2 : 1 })
  }

  if (!spread) return null

  // Estilo por imagem: precisa ser inline (não classe Tailwind) porque a
  // largura no fit "largura" depende de quantas páginas o spread tem (1 ou
  // 2), um valor calculado em runtime que o JIT do Tailwind não consegue ver.
  const imageStyle: React.CSSProperties =
    fit === 'height'
      ? { height: '100%', width: 'auto' }
      : fit === 'width'
        ? { height: 'auto', width: spread.length === 2 ? '50%' : '100%' }
        : { height: 'auto', width: 'auto', maxWidth: 'none' }

  return (
    // Ver justificativa em single-view.tsx: zonas de mouse, não de teclado.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'relative flex size-full items-start justify-center overflow-auto bg-reader-bg',
        !showChrome && 'scrollbar-hidden',
      )}
    >
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
              className="select-none"
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
