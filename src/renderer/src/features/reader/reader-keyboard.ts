import { useEffect } from 'react'

/**
 * Ações do leitor mapeadas a partir do teclado (docs/06-leitor.md §5). A
 * tabela vive só em `mapKeyToAction` (pura, testável); `useReaderKeyboard`
 * cuida só do listener e de ignorar teclas com o foco num input.
 *
 * Os modos double/vertical (`doubleOffset`, largura da coluna) e o painel de
 * atalhos (`?`) chegam junto dos próprios modos — a ação já existe aqui pra
 * não precisar mexer no mapeamento de novo depois.
 */
export type ReaderKeyAction =
  | 'next'
  | 'prev'
  | 'scrollDown'
  | 'scrollUp'
  | 'first'
  | 'last'
  | 'goToPage'
  | 'modeSingle'
  | 'modeDouble'
  | 'modeVertical'
  | 'toggleFit'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'
  | 'toggleDoubleOffset'
  | 'toggleFullscreen'
  | 'toggleFavorite'
  | 'escape'
  | 'exit'
  | 'showShortcuts'

export function mapKeyToAction(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>,
): ReaderKeyAction | null {
  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
      return 'next'
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev'
    case ' ':
      return event.shiftKey ? 'scrollUp' : 'scrollDown'
    case 'ArrowDown':
      return 'scrollDown'
    case 'ArrowUp':
      return 'scrollUp'
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    case 'g':
    case 'G':
      return 'goToPage'
    case '1':
      return 'modeSingle'
    case '2':
      return 'modeDouble'
    case '3':
      return 'modeVertical'
    case 'w':
    case 'W':
      return 'toggleFit'
    case '+':
    case '=':
      return 'zoomIn'
    case '-':
      return 'zoomOut'
    case '0':
      return 'zoomReset'
    case 'o':
    case 'O':
      return 'toggleDoubleOffset'
    case 'f':
    case 'F':
    case 'F11':
      return 'toggleFullscreen'
    case 's':
    case 'S':
      return 'toggleFavorite'
    case 'Escape':
      return 'escape'
    case 'Backspace':
      return 'exit'
    case '?':
      return 'showShortcuts'
    default:
      return null
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

/** Ativo só na rota do leitor (docs §5): quem monta este hook decide isso montando/desmontando o componente. */
export function useReaderKeyboard(onAction: (action: ReaderKeyAction) => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return
      const action = mapKeyToAction(event)
      if (!action) return
      event.preventDefault()
      onAction(action)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAction])
}
