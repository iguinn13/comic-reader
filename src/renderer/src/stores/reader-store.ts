import { create } from 'zustand'
import { DEFAULT_READER_PREFS } from '@shared/constants'
import type { ReaderPrefs, ReaderSession } from '@shared/types'
import { api } from '@renderer/lib/api'
import { computeSpreads, type SpreadDims } from '@renderer/features/reader/compute-spreads'
interface ReaderState {
  session: ReaderSession | null
  currentPage: number
  prefs: ReaderPrefs
  chromeVisible: boolean
  isFullscreen: boolean
  endPanelOpen: boolean
  completedThisSession: boolean
  pdfPageSizes: Record<
    number,
    {
      width: number
      height: number
    }
  >
  loadSession: (session: ReaderSession) => void
  goTo: (page: number) => void
  next: () => void
  prev: () => void
  setPrefs: (patch: Partial<ReaderPrefs>) => void
  reportPdfPageSize: (index: number, width: number, height: number) => void
  applyPrefsFromMain: (prefs: ReaderPrefs) => void
  setChromeVisible: (visible: boolean) => void
  setFullscreen: (value: boolean) => void
  setEndPanelOpen: (value: boolean) => void
  reset: () => void
}
const INITIAL_STATE = {
  session: null,
  currentPage: 0,
  prefs: DEFAULT_READER_PREFS,
  chromeVisible: true,
  isFullscreen: false,
  endPanelOpen: false,
  completedThisSession: false,
  pdfPageSizes: {},
} satisfies Partial<ReaderState>
const SAVE_PREFS_DEBOUNCE_MS = 500
let savePrefsTimer: ReturnType<typeof setTimeout> | undefined
function getSpreadDims(
  session: ReaderSession,
  pdfPageSizes: ReaderState['pdfPageSizes'],
): SpreadDims[] {
  if (session.source.kind === 'images') return session.source.pages
  return Array.from({ length: session.comic.pageCount }, (_, index) => ({
    width: pdfPageSizes[index]?.width ?? null,
    height: pdfPageSizes[index]?.height ?? null,
  }))
}
export const useReaderStore = create<ReaderState>((set, get) => ({
  ...INITIAL_STATE,
  loadSession: (session) =>
    set({
      session,
      currentPage: session.currentPage,
      prefs: session.prefs,
      endPanelOpen: false,
      completedThisSession: false,
      pdfPageSizes: {},
    }),
  reportPdfPageSize: (index, width, height) =>
    set((state) => {
      const existing = state.pdfPageSizes[index]
      if (existing && existing.width === width && existing.height === height) return state
      return { pdfPageSizes: { ...state.pdfPageSizes, [index]: { width, height } } }
    }),
  goTo: (page) => {
    const { session, completedThisSession } = get()
    if (!session) return
    const clamped = Math.max(0, Math.min(page, session.comic.pageCount - 1))
    set({ currentPage: clamped })
    api.reader.setPage(session.comic.id, clamped)
    if (clamped === session.comic.pageCount - 1 && !completedThisSession) {
      set({ completedThisSession: true })
      void api.reader.complete(session.comic.id)
    }
  },
  next: () => {
    const { session, currentPage, prefs, pdfPageSizes } = get()
    if (!session) return
    if (prefs.mode === 'double') {
      const spreads = computeSpreads(getSpreadDims(session, pdfPageSizes), prefs.doubleOffset)
      const spreadIndex = spreads.findIndex((spread) => spread.includes(currentPage))
      const nextSpread = spreads[spreadIndex + 1]
      if (!nextSpread) {
        set({ endPanelOpen: true })
        return
      }
      get().goTo(nextSpread[0])
      return
    }
    if (currentPage >= session.comic.pageCount - 1) {
      set({ endPanelOpen: true })
      return
    }
    get().goTo(currentPage + 1)
  },
  prev: () => {
    const { session, currentPage, prefs, pdfPageSizes } = get()
    if (!session) return
    if (prefs.mode === 'double') {
      const spreads = computeSpreads(getSpreadDims(session, pdfPageSizes), prefs.doubleOffset)
      const spreadIndex = spreads.findIndex((spread) => spread.includes(currentPage))
      const prevSpread = spreadIndex > 0 ? spreads[spreadIndex - 1] : undefined
      if (!prevSpread) return
      get().goTo(prevSpread[0])
      return
    }
    get().goTo(currentPage - 1)
  },
  setPrefs: (patch) => {
    set((state) => ({ prefs: { ...state.prefs, ...patch } }))
    const { session, currentPage, prefs, pdfPageSizes } = get()
    if (!session) return
    if (patch.mode === 'double') {
      const spreads = computeSpreads(getSpreadDims(session, pdfPageSizes), prefs.doubleOffset)
      const spread = spreads.find((s) => s.includes(currentPage))
      if (spread && spread[0] !== currentPage) set({ currentPage: spread[0] })
    }
    clearTimeout(savePrefsTimer)
    savePrefsTimer = setTimeout(() => {
      void api.reader.savePrefs(session.comic.id, get().prefs)
    }, SAVE_PREFS_DEBOUNCE_MS)
  },
  applyPrefsFromMain: (prefs) => {
    clearTimeout(savePrefsTimer)
    set({ prefs })
  },
  setChromeVisible: (chromeVisible) => set({ chromeVisible }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setEndPanelOpen: (endPanelOpen) => set({ endPanelOpen }),
  reset: () => {
    clearTimeout(savePrefsTimer)
    set(INITIAL_STATE)
  },
}))
export function useShowChrome(): boolean {
  return useReaderStore((s) => s.chromeVisible || !s.isFullscreen)
}
