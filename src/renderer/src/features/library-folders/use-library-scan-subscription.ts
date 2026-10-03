import { useEffect, useState } from 'react'
import type { LibraryScanState } from '@shared/types'
import { api } from '@renderer/lib/api'
const INITIAL_STATE: LibraryScanState = { scanning: false, scanned: 0, added: 0, removed: 0 }
export function useLibraryScanState(): LibraryScanState {
  const [state, setState] = useState<LibraryScanState>(INITIAL_STATE)
  useEffect(() => api.library.onScanProgress(setState), [])
  return state
}
