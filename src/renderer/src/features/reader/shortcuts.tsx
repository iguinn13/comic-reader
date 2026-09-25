import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'

/** docs/06-leitor.md §5: teclas exibidas e a chave i18n da ação. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '→ / PageDown', action: 'next' },
  { keys: '← / PageUp', action: 'prev' },
  { keys: 'Espaço / Shift+Espaço', action: 'space' },
  { keys: '↓ / ↑', action: 'scroll' },
  { keys: 'Home / End', action: 'firstLast' },
  { keys: 'G', action: 'goToPage' },
  { keys: '1 / 2 / 3', action: 'modes' },
  { keys: 'W', action: 'toggleFit' },
  { keys: '+ / -', action: 'zoom' },
  { keys: '0', action: 'zoomReset' },
  { keys: 'O', action: 'doubleOffset' },
  { keys: 'F / F11', action: 'fullscreen' },
  { keys: 'S', action: 'favorite' },
  { keys: 'Esc', action: 'escape' },
  { keys: 'Backspace', action: 'exit' },
  { keys: '?', action: 'help' },
]

/** Tabela somente leitura de atalhos (Configurações e painel `?` do leitor). */
export function ShortcutsTable(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {SHORTCUTS.map(({ keys, action }) => (
        <div key={action} className="contents">
          <dt>
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
              {keys}
            </kbd>
          </dt>
          <dd className="text-text-muted">{t(`shortcuts.${action}`)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Painel de atalhos do leitor (`?`, RF-35). */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        </DialogHeader>
        <ShortcutsTable />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
