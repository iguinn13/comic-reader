import { create } from 'zustand'
interface UiState {
  sidebarCollapsedPref: boolean
  setSidebarCollapsedPref: (value: boolean) => void
  isWindowNarrow: boolean
  setIsWindowNarrow: (value: boolean) => void
}
export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsedPref: false,
  setSidebarCollapsedPref: (value) => set({ sidebarCollapsedPref: value }),
  isWindowNarrow: false,
  setIsWindowNarrow: (value) => set({ isWindowNarrow: value }),
}))
