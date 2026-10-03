import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, useToastStore } from './toast-store'
beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})
afterEach(() => {
  vi.useRealTimers()
})
describe('toast-store', () => {
  it('empilha toasts e remove cada um após 4 s', () => {
    toast('primeiro')
    vi.advanceTimersByTime(2000)
    toast('segundo')
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['primeiro', 'segundo'])
    vi.advanceTimersByTime(2000)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['segundo'])
    vi.advanceTimersByTime(2000)
    expect(useToastStore.getState().toasts).toEqual([])
  })
  it('guarda a ação de desfazer, e dispensar manualmente remove o toast', () => {
    const run = vi.fn()
    toast('feito', { label: 'Desfazer', run })
    const [item] = useToastStore.getState().toasts
    item.action?.run()
    useToastStore.getState().dismiss(item.id)
    expect(run).toHaveBeenCalledOnce()
    expect(useToastStore.getState().toasts).toEqual([])
  })
})
