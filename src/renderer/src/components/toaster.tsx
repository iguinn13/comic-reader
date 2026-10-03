import { useToastStore } from '@renderer/stores/toast-store'
export function Toaster(): React.JSX.Element {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm text-text shadow-lg"
        >
          <span>{item.message}</span>
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.run()
                dismiss(item.id)
              }}
              className="font-medium text-accent hover:underline"
            >
              {item.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
