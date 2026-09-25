/** Só a dimensão importa aqui — serve tanto para `ReaderPage[]` (HQs em imagem) quanto para o mapa de tamanhos medidos de páginas de PDF (docs/06 §3.4). */
export interface SpreadDims {
  width: number | null
  height: number | null
}

/**
 * Monta os spreads do modo página dupla (docs/06-leitor.md §3.2, RF-32):
 * 1. A página 0 (capa) fica sempre sozinha.
 * 2. Uma página larga (`width > height`) fica sozinha.
 * 3. As demais formam pares em ordem.
 * 4. Com `doubleOffset`, a capa passa a ter par e os pares se deslocam em 1.
 * 5. Uma página final sem par fica sozinha.
 *
 * Dimensão desconhecida (`width`/`height` nulos, ainda não medida) é tratada
 * como retrato — a spec pede recálculo quando a imagem carrega, o que aqui
 * vira só chamar de novo com as dimensões atualizadas (a função é pura).
 */
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
