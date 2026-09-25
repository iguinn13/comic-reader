import { createHashRouter } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { FavoritesPage } from './features/favorites/favorites-page'
import { HomePage } from './features/home/home-page'
import { LibraryPage } from './features/library/library-page'
import { ReaderPage } from './features/reader/reader-page'
import { SettingsPage } from './features/settings/settings-page'

/**
 * `HashRouter` (docs/02-arquitetura.md §1): o app é carregado como arquivo
 * local (`file://`) fora de dev, sem servidor pra resolver rotas por path.
 *
 * `/read/:comicId` fica **fora** do `AppShell` (docs/06-leitor.md §1: "o
 * leitor ocupa a área toda: a sidebar é escondida no leitor, que tem o
 * próprio botão Voltar").
 */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '/read/:comicId', element: <ReaderPage /> },
])
