export interface SpreadDims {
  width: number | null
  height: number | null
}
export function computeSpreads(pages: SpreadDims[], doubleOffset: boolean): number[][] {
  if (pages.length === 0) return []
  function isWide(index: number): boolean {
    const page = pages[index]
    return page.width !== null && page.height !== null && page.width > page.height
  }
  const spreads: number[][] = []
  let i = 0
  if (!doubleOffset) {
    spreads.push([0])
    i = 1
  }
  while (i < pages.length) {
    if (isWide(i)) {
      spreads.push([i])
      i += 1
      continue
    }
    if (i + 1 < pages.length && !isWide(i + 1)) {
      spreads.push([i, i + 1])
      i += 2
      continue
    }
    spreads.push([i])
    i += 1
  }
  return spreads
}
