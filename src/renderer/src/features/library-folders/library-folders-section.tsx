import { FolderPlus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { queryKeys } from '@renderer/lib/query-keys'
export function LibraryFoldersSection(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: folders } = useQuery({
    queryKey: queryKeys.libraryFolders.all(),
    queryFn: api.libraryFolders.list,
  })
  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.libraryFolders.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.all() })
  }
  const add = useMutation({ mutationFn: api.libraryFolders.add, onSuccess: invalidate })
  const remove = useMutation({ mutationFn: api.libraryFolders.remove, onSuccess: invalidate })
  return (
    <div className="flex flex-col gap-3">
      {folders && folders.length === 0 && (
        <p className="text-sm text-text-muted">{t('settings.folders.empty')}</p>
      )}

      {folders && folders.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {folders.map((folder) => (
            <li
              key={folder.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="truncate text-sm text-text" title={folder.path}>
                {folder.path}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('settings.folders.remove')}
                disabled={remove.isPending}
                onClick={() => remove.mutate(folder.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button variant="outline" disabled={add.isPending} onClick={() => add.mutate()}>
          <FolderPlus className="size-4" aria-hidden />
          {t('settings.folders.add')}
        </Button>
      </div>
    </div>
  )
}
