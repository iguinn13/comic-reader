import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'

/**
 * Invalida a biblioteca (grade, Favoritas, Início) sempre que o main avisa
 * `library:changed` — scan de pastas, exclusão ou capa gerada (docs/02
 * §8, docs/04 §4.2). Precisa ficar montado perto da raiz do app.
 */
export function useLibraryChangedSubscription(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    return api.library.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
    })
  }, [queryClient])
}
