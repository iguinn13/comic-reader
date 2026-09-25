import type { Dirent } from 'fs'
import { readdir } from 'fs/promises'
import { extname, join } from 'path'
import { IMPORTABLE_EXTENSIONS } from '@shared/constants'
import { logger } from './logger'

/** Nomes de pasta sempre ignorados ao escanear uma pasta-raiz (docs/05-importacao.md). */
const IGNORED_DIR_NAMES = new Set(['.git', '__MACOSX', 'node_modules'])

/**
 * Percorre `root` recursivamente ("pode estar em cadeia" — subpastas
 * encadeadas, docs/05-importacao.md) e devolve os caminhos absolutos dos
 * arquivos cuja extensão está em `IMPORTABLE_EXTENSIONS`. Pastas
 * simbólicas não são seguidas (evita ciclos); dotfiles e nomes conhecidos de
 * lixo (`.git`, `__MACOSX`) são pulados.
 */
export async function* walkDirectory(root: string): AsyncGenerator<string> {
  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    logger.warn(`[scan] não foi possível ler "${root}":`, error)
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(root, entry.name)

    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue
      yield* walkDirectory(fullPath)
      continue
    }

    if (!entry.isFile()) continue
    const ext = extname(entry.name).toLowerCase()
    if ((IMPORTABLE_EXTENSIONS as readonly string[]).includes(ext)) {
      yield fullPath
    }
  }
}
