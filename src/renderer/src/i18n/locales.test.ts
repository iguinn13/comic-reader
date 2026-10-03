import { describe, expect, it } from 'vitest'
import enUS from './locales/en-US.json'
import ptBR from './locales/pt-BR.json'
type TranslationTree = {
  [key: string]: string | TranslationTree
}
function collectKeyPaths(tree: TranslationTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : collectKeyPaths(value, path)
  })
}
describe('locale key parity', () => {
  it('pt-BR and en-US expose the exact same set of keys', () => {
    const ptKeys = collectKeyPaths(ptBR).sort()
    const enKeys = collectKeyPaths(enUS).sort()
    expect(enKeys).toEqual(ptKeys)
  })
})
