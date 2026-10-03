import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
export function useLibraryChangedSubscription(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    return api.library.onChanged(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
    })
  }, [queryClient])
}
