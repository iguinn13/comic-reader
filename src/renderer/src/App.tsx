import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ImportButton, ImportRoot } from '@renderer/features/import'

/**
 * Tela provisória do milestone M0 (fundação do projeto): só existe para
 * confirmar visualmente que o tema escuro, a fonte Inter e os componentes
 * base (Button/Input) estão funcionando. A sidebar, as rotas e as telas reais
 * chegam em M3 (docs/08-plano-de-implementacao.md).
 *
 * A UI de importação (M2.7) é montada aqui como ponto de entrada visível e
 * testável desde já: o botão "Importar" e o `ImportRoot` (assinatura de
 * progresso + overlay de drag & drop + painel flutuante). A integração
 * definitiva na sidebar acontece em M3.1 (docs/08-plano-de-implementacao.md);
 * até lá, esses componentes só precisam ficar montados perto da raiz do app.
 */
function App(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text">{t('app.title')}</h1>
        <p className="text-sm text-text-muted">{t('app.tagline')}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <Input placeholder={t('common.comingSoon')} />
        <div className="flex gap-2">
          <Button>{t('common.comingSoon')}</Button>
          <Button variant="outline">{t('common.comingSoon')}</Button>
        </div>
        <ImportButton />
      </div>

      <ImportRoot />
    </div>
  )
}

export default App
