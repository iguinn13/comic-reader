import { createReadStream } from 'fs'
import { readFile, stat } from 'fs/promises'
import { Readable } from 'stream'
import { protocol } from 'electron'
import type { Db } from './db/client'
import { getComicFileMeta } from './db/repositories/comics'
import { logger } from './utils/logger'
import { withTiming } from './utils/perf'
import type { AppPaths } from './utils/paths'
import type { PageCacheService } from './services/page-cache-service'

/** docs/02-arquitetura.md §5: precisa ser chamado antes de `app.ready`. */
export function registerComicProtocolAsPrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'comic',
      // `corsEnabled` é o que permite `fetch()`/XHR de dentro do renderer
      // (origem http://localhost em dev, file:// em produção) buscar
      // `comic://...` — sem isso, só usos "passivos" (`<img src>`) funcionam;
      // o pdf.js (docs/06 §3.4) precisa buscar os bytes via `fetch` (ver
      // `usePdfDocument`), então passou a precisar disto.
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Chave (sha1 hex) da capa de pasta escolhida pelo usuário — nunca vira caminho sem validar. */
const SHA1_RE = /^[0-9a-f]{40}$/

function notFound(): Response {
  return new Response(null, { status: 404 })
}

const FILE_CONTENT_TYPE: Record<'zip' | 'rar' | 'pdf', string> = {
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  pdf: 'application/pdf',
}

/**
 * Serve um arquivo local inteiro, com suporte a `Range` (docs/02 §5:
 * `comic://file/{id}` é o que o pdf.js usa pra carregar PDFs — arquivos que
 * podem ser grandes o bastante pra não fazer sentido carregar tudo em
 * memória de uma vez).
 */
async function serveFile(
  filePath: string,
  contentType: string,
  rangeHeader: string | null,
): Promise<Response> {
  const stats = await stat(filePath)

  if (!rangeHeader) {
    const stream = createReadStream(filePath)
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'Accept-Ranges': 'bytes',
      },
    })
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
  if (!match) return new Response(null, { status: 416 })

  const start = match[1] ? Number(match[1]) : 0
  const end = match[2] ? Number(match[2]) : stats.size - 1
  const stream = createReadStream(filePath, { start, end })

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}

/**
 * Trata as quatro rotas de `comic://` (docs/02-arquitetura.md §5). O id da
 * URL nunca vira caminho diretamente: só serve pra escolher o arquivo certo
 * (via `paths.ts`/o banco) depois de validado como UUID — a regra do
 * checklist de segurança (docs/02 §5).
 */
export function registerComicProtocolHandler(
  paths: AppPaths,
  db: Db,
  pageCache: PageCacheService,
): void {
  protocol.handle('comic', async (request) => {
    const url = new URL(request.url)
    const kind = url.hostname
    const segments = url.pathname.split('/').filter(Boolean)

    try {
      if (kind === 'cover') return await handleCover(paths, segments)
      if (kind === 'page') {
        return await withTiming(`comic://page/${segments.join('/')}`, () =>
          handlePage(pageCache, segments),
        )
      }
      if (kind === 'file') return await handleFile(db, segments, request)
      return notFound()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return notFound()
      logger.error(`[protocol] falha ao servir ${request.url}:`, error)
      return new Response(null, { status: 500 })
    }
  })
}

async function handleCover(paths: AppPaths, segments: string[]): Promise<Response> {
  const [target, id] = segments
  let filePath: string
  if (target === 'comic' && id && UUID_RE.test(id)) filePath = paths.comicCoverFile(id)
  else if (target === 'folder' && id && SHA1_RE.test(id)) filePath = paths.folderCoverFile(id)
  else return notFound()

  const data = await readFile(filePath)
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'max-age=31536000, immutable',
    },
  })
}

async function handlePage(pageCache: PageCacheService, segments: string[]): Promise<Response> {
  const [comicId, pageIndexRaw] = segments
  const pageIndex = Number(pageIndexRaw)
  if (!comicId || !UUID_RE.test(comicId) || !Number.isInteger(pageIndex) || pageIndex < 0) {
    return notFound()
  }

  const { path, contentType } = await pageCache.getPage(comicId, pageIndex)
  const data = await readFile(path)
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'max-age=31536000, immutable',
    },
  })
}

async function handleFile(db: Db, segments: string[], request: Request): Promise<Response> {
  const [comicId] = segments
  if (!comicId || !UUID_RE.test(comicId)) return notFound()

  const meta = getComicFileMeta(db, comicId)
  if (!meta) return notFound()

  return serveFile(meta.filePath, FILE_CONTENT_TYPE[meta.format], request.headers.get('Range'))
}
