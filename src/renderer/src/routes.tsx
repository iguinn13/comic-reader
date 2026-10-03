import { createHashRouter } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { FavoritesPage } from './features/favorites/favorites-page'
import { HomePage } from './features/home/home-page'
import { LibraryPage } from './features/library/library-page'
import { ReaderPage } from './features/reader/reader-page'
import { SettingsPage } from './features/settings/settings-page'
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
