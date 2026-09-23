import { useTranslation } from 'react-i18next'
import { Import } from 'lucide-react'
import { Button, type ButtonProps } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'

/**
 * Botão "Importar": abre o diálogo nativo do SO (`pickFiles`) e, se o usuário
 * escolher algo, inicia a importação (docs/04-contratos-ipc.md §4.2, RF-01).
 * Ponto de entrada visível hoje na tela provisória do M0 (ver `App.tsx`); a
 * versão definitiva mora na sidebar a partir de M3.1.
 */
export function ImportButton(props: Omit<ButtonProps, 'onClick' | 'children'>): React.JSX.Element {
  const { t } = useTranslation()

  async function handleClick(): Promise<void> {
    const paths = await api.importer.pickFiles()
    if (paths.length === 0) return
    await api.importer.start(paths)
  }

  return (
    <Button {...props} onClick={() => void handleClick()}>
      <Import />
      {t('import.button')}
    </Button>
  )
}
