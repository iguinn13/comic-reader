import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
interface GoToPageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalPages: number
  currentPage: number
  onGoTo: (pageIndex: number) => void
}
export function GoToPageDialog({
  open,
  onOpenChange,
  totalPages,
  currentPage,
  onGoTo,
}: GoToPageDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState(() => String(currentPage + 1))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [open])
  function submit(): void {
    const page = Number(value)
    if (Number.isInteger(page) && page >= 1 && page <= totalPages) {
      onGoTo(page - 1)
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reader.goToPage.title')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            {t('reader.goToPage.label', { total: totalPages })}
            <Input
              ref={inputRef}
              type="number"
              min={1}
              max={totalPages}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>

          <DialogFooter className="mt-4">
            <Button type="submit">{t('reader.goToPage.go')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
