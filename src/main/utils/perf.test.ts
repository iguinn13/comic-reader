import { beforeEach, describe, expect, it, vi } from 'vitest'
const info = vi.fn()
vi.mock('./logger', () => ({ logger: { info } }))
const { setPerfLogging, withTiming } = await import('./perf')
beforeEach(() => {
  info.mockClear()
  setPerfLogging(false)
})
describe('withTiming', () => {
  it('desligado: só devolve o resultado, sem logar', async () => {
    expect(await withTiming('x', () => Promise.resolve(42))).toBe(42)
    expect(info).not.toHaveBeenCalled()
  })
  it('ligado: loga o rótulo com o tempo, inclusive quando a função falha', async () => {
    setPerfLogging(true)
    await withTiming('ok', () => Promise.resolve(1))
    await expect(
      withTiming('falha', () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(info).toHaveBeenCalledTimes(2)
    expect(info.mock.calls[0][0]).toMatch(/^\[perf\] ok: [\d.]+ ms$/)
    expect(info.mock.calls[1][0]).toMatch(/^\[perf\] falha: /)
  })
})
