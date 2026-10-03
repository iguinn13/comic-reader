import { create } from 'zustand'
import type { ComicId } from '@shared/types'
interface SelectionState {
  selectedIds: Set<ComicId>
  toggle: (id: ComicId) => void
  clear: () => void
}
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    }),
  clear: () => set({ selectedIds: new Set() }),
}))
