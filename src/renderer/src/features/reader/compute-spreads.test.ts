import { describe, expect, it } from 'vitest'
import type { ReaderPage } from '@shared/types'
import { computeSpreads } from './compute-spreads'

function portraitPages(count: number): ReaderPage[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    url: `comic://page/x/${index}`,
    width: 800,
    height: 1200,
  }))
}

describe('computeSpreads', () => {
  it('capa sozinha, depois pares em ordem', () => {
    expect(computeSpreads(portraitPages(5), false)).toEqual([[0], [1, 2], [3, 4]])
  })

  it('página final sem par fica sozinha', () => {
    expect(computeSpreads(portraitPages(4), false)).toEqual([[0], [1, 2], [3]])
  })

  it('uma página larga no meio fica sozinha, sem quebrar o pareamento das outras', () => {
    const pages = portraitPages(5)
    pages[2] = { ...pages[2], width: 1600, height: 900 } // larga
    expect(computeSpreads(pages, false)).toEqual([[0], [1], [2], [3, 4]])
  })

  it('página larga logo após um par ainda fecha o par anterior corretamente', () => {
    const pages = portraitPages(6)
    pages[3] = { ...pages[3], width: 1600, height: 900 } // larga
    expect(computeSpreads(pages, false)).toEqual([[0], [1, 2], [3], [4, 5]])
  })

  it('dimensão desconhecida (null) é tratada como retrato', () => {
    const pages = portraitPages(3).map((p) => ({ ...p, width: null, height: null }))
    expect(computeSpreads(pages, false)).toEqual([[0], [1, 2]])
  })

  it('doubleOffset desloca os pares em 1, dando par pra capa', () => {
    expect(computeSpreads(portraitPages(5), true)).toEqual([[0, 1], [2, 3], [4]])
  })

  it('lista vazia devolve nenhum spread', () => {
    expect(computeSpreads([], false)).toEqual([])
  })

  it('uma única página fica sozinha, com ou sem offset', () => {
    expect(computeSpreads(portraitPages(1), false)).toEqual([[0]])
    expect(computeSpreads(portraitPages(1), true)).toEqual([[0]])
  })
})
