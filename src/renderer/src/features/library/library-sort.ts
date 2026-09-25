import type { LibraryQuery } from '@shared/types'

export type LibrarySortOption = 'createdAt' | 'lastReadAt' | 'titleAsc' | 'titleDesc'

export function sortOptionToQuery(option: LibrarySortOption): Pick<LibraryQuery, 'sort' | 'order'> {
  switch (option) {
    case 'lastReadAt':
      return { sort: 'lastReadAt', order: 'desc' }
    case 'titleAsc':
      return { sort: 'title', order: 'asc' }
    case 'titleDesc':
      return { sort: 'title', order: 'desc' }
    default:
      return { sort: 'createdAt', order: 'desc' }
  }
}
