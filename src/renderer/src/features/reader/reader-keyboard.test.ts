import { describe, expect, it } from 'vitest'
import { mapKeyToAction } from './reader-keyboard'

describe('mapKeyToAction', () => {
  it.each([
    ['ArrowRight', 'next'],
    ['PageDown', 'next'],
    ['ArrowLeft', 'prev'],
    ['PageUp', 'prev'],
    ['Home', 'first'],
    ['End', 'last'],
    ['g', 'goToPage'],
    ['1', 'modeSingle'],
    ['2', 'modeDouble'],
    ['3', 'modeVertical'],
    ['w', 'toggleFit'],
    ['+', 'zoomIn'],
    ['-', 'zoomOut'],
    ['0', 'zoomReset'],
    ['o', 'toggleDoubleOffset'],
    ['f', 'toggleFullscreen'],
    ['F11', 'toggleFullscreen'],
    ['l', 'toggleFocusMode'],
    ['s', 'toggleFavorite'],
    ['Escape', 'escape'],
    ['Backspace', 'exit'],
    ['?', 'showShortcuts'],
  ] as const)('%s → %s', (key, action) => {
    expect(mapKeyToAction({ key, shiftKey: false })).toBe(action)
  })

  it('Espaço avança e Shift+Espaço volta (docs/06 §5)', () => {
    expect(mapKeyToAction({ key: ' ', shiftKey: false })).toBe('scrollDown')
    expect(mapKeyToAction({ key: ' ', shiftKey: true })).toBe('scrollUp')
  })

  it('devolve null para teclas sem atalho', () => {
    expect(mapKeyToAction({ key: 'x', shiftKey: false })).toBeNull()
  })
})
