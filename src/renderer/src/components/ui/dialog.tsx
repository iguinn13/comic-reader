import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/**
 * Componente na convenção shadcn/ui (wrapping de @radix-ui/react-dialog),
 * temado com os tokens de docs/07-ui-ux.md (raio de 12px para diálogos,
 * superfície `surface-2`). Segue o mesmo padrão de button.tsx/input.tsx.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 ease-out',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-surface-2 p-6 shadow-lg transition-opacity duration-150 ease-out',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md text-text-subtle transition-colors duration-150 ease-out hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <X className="size-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-base font-semibold text-text', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-text-muted', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
