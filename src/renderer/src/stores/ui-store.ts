import { create } from 'zustand'

/**
 * Estado de UI da sidebar (RF-60, docs/07-ui-ux.md §3). A preferência de
 * recolher/expandir é persistida em `settings['ui.sidebarCollapsed']` por
 * quem monta o app (`AppShell`); esta store só guarda o valor em memória para
 * não esperar um round-trip de IPC a cada toggle, mais o auto-recolhimento
 * por largura de janela, que NÃO é persistido (é recalculado a cada resize).
 */
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
