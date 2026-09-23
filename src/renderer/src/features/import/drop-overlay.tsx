import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderInput } from 'lucide-react'
import { api } from '@renderer/lib/api'

/**
 * Overlay de drag & drop em tela cheia (docs/05-importacao.md §7). Escuta os
 * eventos na `window` inteira (não só num componente local) para o overlay
 * aparecer não importa onde o usuário solte o arquivo, e bloqueia
 * `dragover`/`drop` padrão globalmente para a janela nunca navegar.
 */
export function DropOverlay(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)

  useEffect(() => {
    // Contador de enter/leave: dragenter/dragleave disparam para cada
    // elemento sobrevoado, então um único dragleave não significa que o
    // arrasto saiu da janela — só quando o contador volta a zero.
    let dragDepth = 0

    function hasFiles(event: DragEvent): boolean {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }

    function onDragEnter(event: DragEvent): void {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth += 1
      setIsDraggingFiles(true)
    }

    function onDragOver(event: DragEvent): void {
      if (!hasFiles(event)) return
      event.preventDefault()
    }

    function onDragLeave(event: DragEvent): void {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setIsDraggingFiles(false)
    }

    function onDrop(event: DragEvent): void {
      event.preventDefault()
      dragDepth = 0
      setIsDraggingFiles(false)

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      const paths = api.importer.pathsForFiles(files)
      if (paths.length === 0) return
      void api.importer.start(paths)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  if (!isDraggingFiles) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 border-4 border-dashed border-accent bg-bg/90 text-center">
      <FolderInput className="size-12 text-accent" />
      <p className="text-xl font-semibold text-text">{t('import.dropOverlay')}</p>
    </div>
  )
}
