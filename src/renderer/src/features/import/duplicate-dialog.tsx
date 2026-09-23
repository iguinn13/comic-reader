import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import type { ImportItem } from '@shared/types'

interface DuplicateDialogProps {
  jobId: string
  item: ImportItem
}

/**
 * Diálogo de duplicata (docs/05-importacao.md §6, docs/04 §4.2
 * `resolveDuplicate`). Aparece quando o job está `paused-for-decision` e um
 * item está `awaiting-duplicate-decision` com `duplicateOf` preenchido.
 */
export function DuplicateDialog({ jobId, item }: DuplicateDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [applyToAll, setApplyToAll] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function resolve(decision: 'skip' | 'import'): Promise<void> {
    setIsSubmitting(true)
    try {
      await api.importer.resolveDuplicate(jobId, item.id, decision, applyToAll)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open>
      <DialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('import.duplicate.title')}</DialogTitle>
          <DialogDescription>
            {t('import.duplicate.description', {
              sourceName: item.sourceName,
              existingTitle: item.duplicateOf?.title ?? '',
            })}
          </DialogDescription>
        </DialogHeader>

        <label className="flex items-center gap-2 text-sm text-text">
          <Checkbox
            checked={applyToAll}
            onCheckedChange={(checked) => setApplyToAll(checked === true)}
          />
          {t('import.duplicate.applyToAll')}
        </label>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={() => void resolve('skip')}>
            {t('import.duplicate.skip')}
          </Button>
          <Button disabled={isSubmitting} onClick={() => void resolve('import')}>
            {t('import.duplicate.importAnyway')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
