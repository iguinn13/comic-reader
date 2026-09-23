import { useImportSubscription } from './use-import-subscription'
import { DropOverlay } from './drop-overlay'
import { ImportPanel } from './import-panel'

export { ImportButton } from './import-button'

/**
 * Agrega as peças "sempre montadas" da importação: a assinatura de progresso,
 * o overlay de drag & drop em tela cheia e o painel flutuante. Pensado para
 * ficar perto da raiz do app (hoje em `App.tsx`; na sidebar a partir de M3.1
 * o lugar muda, mas o componente continua o mesmo).
 */
export function ImportRoot(): React.JSX.Element {
  useImportSubscription()

  return (
    <>
      <DropOverlay />
      <ImportPanel />
    </>
  )
}
