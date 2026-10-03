import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
interface PdfPageProps {
  doc: PDFDocumentProxy | null
  pageIndex: number
  className?: string
  style?: React.CSSProperties
  onMeasured?: (index: number, width: number, height: number) => void
}
export function PdfPage({
  doc,
  pageIndex,
  className,
  style,
  onMeasured,
}: PdfPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!doc) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: RenderTask | null = null
    void doc.getPage(pageIndex + 1).then(async (page) => {
      if (cancelled) return
      const naturalViewport = page.getViewport({ scale: 1 })
      canvas.width = naturalViewport.width
      canvas.height = naturalViewport.height
      onMeasured?.(pageIndex, naturalViewport.width, naturalViewport.height)
      await new Promise(requestAnimationFrame)
      if (cancelled) return
      const displayWidth = canvas.getBoundingClientRect().width || naturalViewport.width
      const scale = (displayWidth * window.devicePixelRatio) / naturalViewport.width
      const viewport = page.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx || cancelled) return
      renderTask = page.render({ canvasContext: ctx, viewport })
      try {
        await renderTask.promise
      } catch {
        return
      }
    })
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, pageIndex, onMeasured])
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={t('reader.pageLabel', { page: pageIndex + 1 })}
      className={className}
      style={style}
    />
  )
}
