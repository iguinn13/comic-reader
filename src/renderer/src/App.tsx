import { RouterProvider } from 'react-router-dom'
import { Toaster } from './components/toaster'
import { router } from './routes'

/**
 * A partir de M3.1 (docs/08-plano-de-implementacao.md), a raiz do app é só o
 * roteador: `AppShell` (sidebar + rotas) mora em `routes.tsx`. A tela
 * provisória do M0 (botão/inputs de exemplo) e a montagem solta da UI de
 * importação saíram daqui — a importação agora vive dentro do `AppShell`.
 */
function App(): React.JSX.Element {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}

export default App
