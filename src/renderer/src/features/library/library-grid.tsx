import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ComicSummary } from '@shared/types'
import { ComicCard } from './comic-card'

/** docs/07-ui-ux.md §4.2: colunas auto-fill, mínimo 190 px, gap 20 px. */
const MIN_CARD_WIDTH = 190
const GRID_GAP = 20
const CARD_ASPECT_HEIGHT_RATIO = 1.5 // capa 2:3
const CARD_META_HEIGHT = 44 // título (2 linhas) + status

/**
 * Grade virtualizada por linha (RF-13, docs/07 §4.2): mede a largura do
 * contêiner, calcula quantas colunas cabem e virtualiza linhas inteiras com
 * `@tanstack/react-virtual`. Precisa da largura para decidir as colunas antes
 * de poder virtualizar, então usa um `ResizeObserver` simples via `useState`.
 */
export function LibraryGrid({
  items,
  onEndReached,
}: {
  items: ComicSummary[]
  onEndReached?: () => void
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Observer criado uma única vez por montagem. Antes era um callback ref inline:
  // a cada render ele era reanexado e alternava entre `clientWidth` (inteiro) e
  // `contentRect.width` (fracionário, ex.: escala 125%) → loop infinito de render
  // que travava a UI (não dava para navegar pela sidebar).
  useEffect(() => {
    const node = parentRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columns = Math.max(1, Math.floor((containerWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)))
  const cardWidth =
    columns > 0 ? (containerWidth - GRID_GAP * (columns - 1)) / columns : MIN_CARD_WIDTH
  const rowHeight = cardWidth * CARD_ASPECT_HEIGHT_RATIO + CARD_META_HEIGHT + GRID_GAP
  const rowCount = Math.ceil(items.length / columns)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const lastVirtualRow = virtualRows[virtualRows.length - 1]

  useEffect(() => {
    if (onEndReached && lastVirtualRow && lastVirtualRow.index >= rowCount - 2) {
      onEndReached()
    }
  }, [onEndReached, lastVirtualRow, rowCount])

  return (
    <div ref={parentRef}className="h-full overflow-y-auto">
      {containerWidth > 0 && (
        <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const start = virtualRow.index * columns
            const rowItems = items.slice(start, start + columns)
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 grid w-full"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: GRID_GAP,
                  height: virtualRow.size,
                }}
              >
                {rowItems.map((comic) => (
                  <ComicCard key={comic.id} comic={comic} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
