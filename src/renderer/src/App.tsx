import { RouterProvider } from 'react-router-dom'
import { Toaster } from './components/toaster'
import { router } from './routes'
function App(): React.JSX.Element {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
export default App
