import { useEffect } from 'react'
import { api } from '@renderer/lib/api'
import { useImportStore } from '@renderer/stores/import-store'

/**
 * Mantém o `import-store` sincronizado com o main: assina `onProgress` uma
 * vez (docs/04-contratos-ipc.md §4.2, evento com throttle de 100ms) e chama
 * `getJob` no mount para reidratar um job em andamento após reload. Deve ser
 * usado uma única vez, perto da raiz do app (ver `App.tsx`).
 */
export function useImportSubscription(): void {
  const setJob = useImportStore((state) => state.setJob)

  useEffect(() => {
    let cancelled = false

    api.importer
      .getJob()
      .then((job) => {
        if (!cancelled) setJob(job)
      })
      .catch(() => {
        // Sem backend real ainda (main em paralelo) ou sem job em andamento:
        // não há o que reidratar, o painel simplesmente começa vazio.
      })

    const unsubscribe = window.api.importer.onProgress((state) => {
      setJob(state)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setJob])
}
