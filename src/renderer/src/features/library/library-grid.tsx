import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ComicSummary } from '@shared/types'
import { ComicCard } from './comic-card'
const MIN_CARD_WIDTH = 190
const GRID_GAP = 20
const CARD_ASPECT_HEIGHT_RATIO = 1.5
const CARD_META_HEIGHT = 44
export function LibraryGrid({
  items,
  onEndReached,
}: {
  items: ComicSummary[]
  onEndReached?: () => void
}): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
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
    <div ref={parentRef} className="h-full overflow-y-auto px-1.5 pt-1.5">
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
