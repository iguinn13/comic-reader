import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { logger } from '../utils/logger'
import type { ResizeToJpeg } from '../utils/native-image-adapter'
import type { AppPaths } from '../utils/paths'

const COVER_TARGET_WIDTH = 400
const COVER_JPEG_QUALITY = 82

/** docs/03-modelo-de-dados.md §3: capa própria de coleção, 600px de largura, JPEG q=85. */
const COLLECTION_COVER_TARGET_WIDTH = 600
const COLLECTION_COVER_JPEG_QUALITY = 85

export interface GenerateCoverResult {
  coverVersion: number
}

/**
 * Geração de miniatura de HQ (docs/05-importacao.md §4 passo 7, RF-06).
 * Recebe `resizeToJpeg` por injeção (adaptador de `nativeImage`, ver
 * docs/02-arquitetura.md §3) para continuar testável em Node puro.
 *
 * Nunca lança: uma falha ao gerar a capa não pode falhar o item de
 * importação (a spec é explícita sobre isso). Quem chama decide o que fazer
 * com `null` — na prática, deixar `cover_version = 0` (placeholder).
 */
export class CoverService {
  constructor(
    private readonly paths: AppPaths,
    private readonly resizeToJpeg: ResizeToJpeg,
  ) {}

  async generateComicCover(
    comicId: string,
    firstPageBuffer: Buffer | null,
  ): Promise<GenerateCoverResult | null> {
    // PDF sem capa renderizada ainda (ver "Escopo reduzido" da tarefa M2 que
    // implementou este serviço): a chamada chega aqui com `null` e o
    // resultado é o placeholder (cover_version = 0), sem tentar nada.
    if (firstPageBuffer === null) return null

    try {
      const jpeg = this.resizeToJpeg(firstPageBuffer, COVER_TARGET_WIDTH, COVER_JPEG_QUALITY)
      const destFile = this.paths.comicCoverFile(comicId)
      await mkdir(dirname(destFile), { recursive: true })
      await writeFile(destFile, jpeg)
      return { coverVersion: 1 }
    } catch (error) {
      logger.error(`[cover] falha ao gerar capa da HQ ${comicId}:`, error)
      return null
    }
  }

  /**
   * Capa própria de coleção (RF-25 modo 2): copia e redimensiona o arquivo
   * escolhido pelo usuário (`collections:pickCoverImage`). Diferente da capa
   * de HQ, aqui uma falha deve **propagar** — é uma ação direta do usuário,
   * não um passo silencioso de importação em lote — então quem chama decide
   * o que fazer com `null` (o `CollectionService` converte em `AppError`).
   */
  async generateCollectionCover(
    collectionId: string,
    sourceFilePath: string,
    previousVersion: number,
  ): Promise<GenerateCoverResult | null> {
    try {
      const source = await readFile(sourceFilePath)
      const jpeg = this.resizeToJpeg(
        source,
        COLLECTION_COVER_TARGET_WIDTH,
        COLLECTION_COVER_JPEG_QUALITY,
      )
      const destFile = this.paths.collectionCoverFile(collectionId)
      await mkdir(dirname(destFile), { recursive: true })
      await writeFile(destFile, jpeg)
      return { coverVersion: previousVersion + 1 }
    } catch (error) {
      logger.error(`[cover] falha ao gerar capa da coleção ${collectionId}:`, error)
      return null
    }
  }

  // TODO(M2-follow-up): capa de PDF. docs/05-importacao.md §4 passo 7 pede
  // renderizar a página 1 do PDF em 400px via o worker de pdf.js numa
  // BrowserWindow oculta (ADR-008, docs/10-decisoes.md), o que exige um
  // Electron rodando de verdade para construir e validar (não disponível no
  // ambiente sandboxed em que a tarefa 2.3/2.4 foi implementada — ver o
  // README de M2 no plano de implementação). Quando isso for retomado: o
  // ImportService deve pedir ao `pdf-worker-window.ts` (a criar) o JPEG da
  // primeira página e passar esse buffer aqui como `firstPageBuffer`, em vez
  // de `null`. Nenhuma mudança de assinatura deveria ser necessária neste
  // método além disso.
}
