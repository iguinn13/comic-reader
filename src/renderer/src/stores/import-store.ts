import { create } from 'zustand'
import type { ImportJobState } from '@shared/types'

/**
 * Estado do job de importação corrente (docs/05-importacao.md §6). É
 * alimentado por `onProgress` (a cada evento do main) e por `getJob` na
 * inicialização, para reidratar um job em andamento após reload (docs/04
 * §4.2). `isMinimized` é só estado de UI do painel, não vem do backend.
 */
interface ImportStoreState {
  job: ImportJobState | null
  isMinimized: boolean
  setJob: (job: ImportJobState | null) => void
  toggleMinimized: () => void
  setMinimized: (value: boolean) => void
}

export const useImportStore = create<ImportStoreState>((set) => ({
  job: null,
  isMinimized: false,
  setJob: (job) => set({ job }),
  toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
  setMinimized: (value) => set({ isMinimized: value }),
}))
