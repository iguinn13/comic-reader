import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
import { cn } from '@renderer/lib/utils'
import { AppError } from '@shared/errors'
import { COLLECTION_DESCRIPTION_MAX_LENGTH, COLLECTION_NAME_MAX_LENGTH } from '@shared/constants'
import type { CollectionSummary, CollectionType } from '@shared/types'

interface CollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tipo pré-selecionado ao criar (a tela de onde veio). */
  defaultType: CollectionType
  /** Quando presente, o diálogo edita esta coleção em vez de criar (RF-21). */
  collection?: CollectionSummary
}

/** Diálogo Nova/Editar coleção (RF-20, RF-21). O tipo só é editável ao editar, convertendo lista ↔ saga. */
export function CollectionDialog(props: CollectionDialogProps): React.JSX.Element {
  // `key` remonta o formulário a cada abertura/alvo, resetando o estado sem efeitos.
  const formKey = `${props.open}-${props.collection?.id ?? 'new'}`
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <CollectionForm key={formKey} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function CollectionForm({
  onOpenChange,
  defaultType,
  collection,
}: CollectionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditing = !!collection

  const [name, setName] = useState(collection?.name ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  const [type, setType] = useState<CollectionType>(collection?.type ?? defaultType)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim() }
      return collection
        ? api.collections.update(collection.id, { ...payload, type })
        : api.collections.create({
            type,
            name: payload.name,
            description: payload.description || undefined,
          })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() })
      onOpenChange(false)
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? t('collections.dialog.editTitle') : t('collections.dialog.newTitle')}
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) mutate()
        }}
      >
        {isEditing && (
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
            {(['list', 'saga'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={cn(
                  'flex-1 rounded px-3 py-1 text-sm transition-colors duration-150 ease-out',
                  type === option ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text',
                )}
              >
                {t(`collections.type.${option}`)}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-sm text-text-muted">
          {t('collections.dialog.name')}
          <Input
            ref={nameRef}
            value={name}
            maxLength={COLLECTION_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-text-muted">
          {t('collections.dialog.description')}
          <textarea
            value={description}
            maxLength={COLLECTION_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(error instanceof AppError ? error.message : 'errors.internal')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('collections.dialog.cancel')}
          </Button>
          <Button type="submit" disabled={isPending || !name.trim()}>
            {t('collections.dialog.save')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
