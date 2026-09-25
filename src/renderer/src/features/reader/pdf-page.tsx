import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

interface PdfPageProps {
  doc: PDFDocumentProxy | null
  pageIndex: number
  className?: string
  style?: React.CSSProperties
  /** docs/06-leitor.md §3.4: reporta a dimensão medida (usada por spreads e placeholders). */
  onMeasured?: (index: number, width: number, height: number) => void
}

/**
 * Página de PDF renderizada em `<canvas>` via pdf.js (docs/06-leitor.md
 * §3.4, RF-01). Duas fases: (1) assim que a página carrega, fixa a proporção
 * natural no canvas para o layout (classes/estilo de fit) calcular o tamanho
 * exibido; (2) depois de medir esse tamanho exibido, redesenha na resolução
 * `larguraExibida × devicePixelRatio` para ficar nítido. Cancela a task de
 * render ao desmontar — é o "descarte fora da janela de pré-carregamento".
 */
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

      // Espera o layout aplicar o fit antes de medir o tamanho exibido real.
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
        // Cancelado (página saiu da janela de pré-carregamento) — ignora.
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
