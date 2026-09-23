/**
 * Normalização de texto para busca e unicidade (docs/03-modelo-de-dados.md
 * §1): minúsculas, sem acentos, espaços colapsados. Usado em
 * `title_normalized` (comics) e `name_normalized` (collections).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
