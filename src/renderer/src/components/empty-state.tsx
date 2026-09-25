import type { ReactNode } from 'react'

/** Estado vazio genérico (docs/07-ui-ux.md §6, RF-62): título + descrição opcional + ação opcional. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-base font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  )
}
