import { create } from 'zustand'
import type { ComicId } from '@shared/types'

/**
 * Seleção múltipla da grade (RF-18, docs/07-ui-ux.md §4.2). Vive numa store
 * global (não local ao componente da grade) porque a barra de seleção
 * substitui a toolbar da própria tela — os dois precisam do mesmo estado.
 *
 * `Ctrl/Shift+clique` alterna um item (RF-18); a v1 não faz seleção de
 * intervalo (Shift para selecionar um range) — cada clique com modificador
 * alterna só aquele card.
 */
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
