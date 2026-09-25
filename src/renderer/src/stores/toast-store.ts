import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  /** Ação reversível opcional ("Desfazer", docs/07 §5). */
  action?: { label: string; run: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

/** docs/07-ui-ux.md §5: os toasts somem sozinhos após 4 s. */
const TOAST_DURATION_MS = 4000
let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    setTimeout(() => get().dismiss(id), TOAST_DURATION_MS)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

/** Atalho para quem não é componente (callbacks de mutation). */
export const toast = (message: string, action?: Toast['action']): void =>
  useToastStore.getState().push({ message, action })
