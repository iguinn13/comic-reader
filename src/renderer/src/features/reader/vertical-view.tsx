import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useReaderStore } from '@renderer/stores/reader-store'
import type { ReaderSource } from '@shared/types'
import { PdfPage } from './pdf-page'
import { usePdfDocument } from './pdf-document'
import { stepVerticalWidth } from './zoom'

/** docs/06-leitor.md §3.3: altura estimada quando a dimensão ainda não é conhecida. */
const FALLBACK_ASPECT_RATIO = 1.5
/** Throttle da detecção de "página atual" durante o scroll. */
const SCROLL_THROTTLE_MS = 150

/**
 * Ao desmontar, zera o `src` para o Chromium soltar o bitmap decodificado na
 * hora, em vez de esperar pressão de memória (RNF-03).
 */
function releaseImageOnUnmount(img: HTMLImageElement | null): (() => void) | void {
  if (!img) return
  return () => {
    img.removeAttribute('src')
  }
}

/**
 * Modo vertical contínuo (docs/06-leitor.md §3.3, RF-33): páginas empilhadas
 * sem gap, largura da coluna = `verticalWidth × largura da área`,
 * virtualizado com `@tanstack/react-virtual`. "Página atual" é a que cruza a
 * linha a 1/3 da viewport.
 */
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
  const focusMode = useReaderStore((s) => s.focusMode)
  const goTo = useReaderStore((s) => s.goTo)
  const setChromeVisible = useReaderStore((s) => s.setChromeVisible)
  const setPrefs = useReaderStore((s) => s.setPrefs)
  const pdfPageSizes = useReaderStore((s) => s.pdfPageSizes)
  const reportPdfPageSize = useReaderStore((s) => s.reportPdfPageSize)

  const pdfDoc = usePdfDocument(source.kind === 'pdf' ? source.fileUrl : null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const hasScrolledToInitialRef = useRef(false)
  /** Página que o próprio scroll já reportou — evita reagir ao próprio `goTo` que ele mesmo disparou. */
  const lastReportedPageRef = useRef(currentPage)

  // Precisa de identidade estável (`useCallback`, deps vazias): uma ref
  // callback recriada a cada render faz o React desmontar/remontar o
  // observer a cada render, e se o conteúdo (páginas de PDF) causar qualquer
  // variação de layout (ex.: barra de rolagem aparecendo), isso reentra em
  // loop — `setContainerWidth` nunca estabiliza porque o observer é sempre
  // outro (React "Maximum update depth exceeded").
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
    // Sem largura medida as estimativas seriam 1 px por página e ficariam em cache.
    enabled: containerWidth > 0,
  })

  // Larguras/dimensões novas invalidam as alturas já estimadas (o cache do
  // virtualizador não observa `estimateSize`).
  useEffect(() => {
    rowVirtualizer.measure()
  }, [columnWidth, pdfPageSizes, rowVirtualizer])

  // docs §3.3: ao abrir ou trocar pra este modo, o topo da página atual vai pro topo da viewport.
  useEffect(() => {
    if (hasScrolledToInitialRef.current || containerWidth === 0) return
    hasScrolledToInitialRef.current = true
    rowVirtualizer.scrollToIndex(currentPage, { align: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira medição, não a cada scroll
  }, [containerWidth])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let lastRun = 0

    function handleScroll(): void {
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

  // `currentPage` mudou por fora (teclado, slider, "ir para página") → rola até ela.
  // O próprio handler de scroll acima também muda `currentPage`, mas já registrou
  // o índice em `lastReportedPageRef` antes de chamar `goTo`, então não se autodispara.
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
    // docs §4.1: sem zonas de avançar/voltar no vertical — só o centro alterna as barras.
    const rect = event.currentTarget.getBoundingClientRect()
    const xRatio = (event.clientX - rect.left) / rect.width
    if (xRatio >= 1 / 3 && xRatio <= 2 / 3 && (isFullscreen || focusMode)) {
      setChromeVisible(!chromeVisible)
    }
  }

  if (pageCount === 0) return null

  return (
    // Ver justificativa em single-view.tsx: zonas de mouse, não de teclado.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={measureRef}
      onWheel={handleWheel}
      onClick={handleClick}
      className="relative size-full overflow-auto bg-reader-bg"
    >
      {containerWidth > 0 && (
        <div
          className="relative mx-auto"
          style={{ height: rowVirtualizer.getTotalSize(), width: columnWidth }}
        >
          {rowVirtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              // Páginas de imagem têm proporção conhecida (estimateSize é exato): medir o DOM só gera re-render em cascata.
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
