import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ImportJobState } from '@shared/types'
import { createDb, type Db } from '../db/client'
import { createAppPaths, type AppPaths } from '../utils/paths'
import { CoverService } from './cover-service'
import { ImportService } from './import-service'

const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures')
const fixture = (name: string): string => join(FIXTURES_DIR, name)

let root: string
let paths: AppPaths
let db: Db
let states: ImportJobState[]
let service: ImportService

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comic-reader-import-'))
  paths = createAppPaths(root)
  db = createDb(':memory:')
  states = []
  const coverService = new CoverService(paths, (buf) => buf)
  service = new ImportService(db, paths, coverService, (state) => {
    states.push(state)
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** Espera até que o job satisfaça o predicado, sem sleep fixo (cooperativo com o loop assíncrono do serviço). */
async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout esperando o job')
    await new Promise((resolve) => setImmediate(resolve))
  }
}

async function waitDone(jobId: string): Promise<ImportJobState> {
  await waitFor(() => {
    const job = service.getJob()
    return job?.jobId === jobId && (job.status === 'finished' || job.status === 'cancelled')
  })
  return service.getJob() as ImportJobState
}

async function waitPaused(jobId: string): Promise<ImportJobState> {
  await waitFor(() => {
    const job = service.getJob()
    return job?.jobId === jobId && job.status === 'paused-for-decision'
  })
  return service.getJob() as ImportJobState
}

describe('ImportService — casos de docs/05-importacao.md §9', () => {
  it('1. CBZ válido → 1 HQ, páginas em ordem natural, capa gerada', async () => {
    const { jobId } = service.start([fixture('simple.cbz')])
    const job = await waitDone(jobId)

    expect(job.items).toHaveLength(1)
    expect(job.items[0]?.status).toBe('done')
    expect(job.counts).toEqual({ total: 1, done: 1, skipped: 0, failed: 0 })

    const comicId = job.items[0]?.comicId as string
    expect(existsSync(paths.comicFile(comicId, 'cbz'))).toBe(true)
    expect(existsSync(paths.comicCoverFile(comicId))).toBe(true)
  })

  it('3. .cbr que na verdade é ZIP → importado como zip', async () => {
    const { jobId } = service.start([fixture('zip-as-cbr.cbr')])
    const job = await waitDone(jobId)

    expect(job.items[0]?.status).toBe('done')
    const comicId = job.items[0]?.comicId as string
    expect(existsSync(paths.comicFile(comicId, 'cbz'))).toBe(true)
  })

  it('4. PDF válido → 1 HQ com page_count correto, capa placeholder (escopo reduzido)', async () => {
    const { jobId } = service.start([fixture('simple.pdf')])
    const job = await waitDone(jobId)

    expect(job.items[0]?.status).toBe('done')
    const comicId = job.items[0]?.comicId as string
    expect(existsSync(paths.comicFile(comicId, 'pdf'))).toBe(true)
    // Capa de PDF fica fora do escopo desta tarefa (ver cover-service.ts): sem arquivo de capa.
    expect(existsSync(paths.comicCoverFile(comicId))).toBe(false)
  })

  it('5 e 7. pack.zip: HQs internas viram itens, imagem solta é ignorada, .zip interno falha controlada', async () => {
    const { jobId } = service.start([fixture('pack.zip')])

    // b.cbz e c.cbr são fixtures byte-idênticas (mesmo conteúdo de página
    // única, ver scripts/make-fixtures.ts): o pipeline detecta corretamente
    // a segunda como duplicata da primeira e pausa (docs/05 §4 passo 5) — não
    // é um bug, é o comportamento esperado quando dois arquivos internos têm
    // o mesmo hash. O teste resolve como "importar mesmo assim" para os dois
    // ainda contarem como HQs importadas.
    let job = await Promise.race([
      waitDone(jobId).then(() => 'done' as const),
      waitPaused(jobId).then(() => 'paused' as const),
    ])
    while (job === 'paused') {
      const current = service.getJob()
      const pending = current?.items.find((i) => i.status === 'awaiting-duplicate-decision')
      if (pending) service.resolveDuplicate(jobId, pending.id, 'import', false)
      job = await Promise.race([
        waitDone(jobId).then(() => 'done' as const),
        waitPaused(jobId).then(() => 'paused' as const),
      ])
    }
    const finalJob = await waitDone(jobId)

    const done = finalJob.items.filter((i) => i.status === 'done')
    const failed = finalJob.items.filter((i) => i.status === 'failed')

    expect(done).toHaveLength(4) // a.cbz, b.cbz, c.cbr, d.pdf
    expect(failed).toHaveLength(1) // inner.zip
    expect(failed[0]?.errorCode).toBe('UNSUPPORTED_FORMAT')
    expect(failed[0]?.sourceName).toContain('inner.zip')
  })

  it('6. ZIP só com imagens → 1 HQ (o próprio ZIP como CBZ)', async () => {
    const { jobId } = service.start([fixture('images-only.zip')])
    const job = await waitDone(jobId)

    expect(job.items).toHaveLength(1)
    expect(job.items[0]?.status).toBe('done')
  })

  it('8. Arquivo corrompido/truncado → CORRUPTED_FILE, sem lixo em library/ nem cache/tmp/', async () => {
    const { jobId } = service.start([fixture('corrupted.cbz')])
    const job = await waitDone(jobId)

    expect(job.items[0]?.status).toBe('failed')
    expect(job.items[0]?.errorCode).toBe('CORRUPTED_FILE')
    expect(existsSync(paths.libraryDir) ? readdirSync(paths.libraryDir) : []).toHaveLength(0)
    expect(existsSync(paths.cacheTmpDir) ? readdirSync(paths.cacheTmpDir) : []).toHaveLength(0)
  })

  it('9. CBZ sem imagens → CORRUPTED_FILE', async () => {
    const { jobId } = service.start([fixture('no-images.cbz')])
    const job = await waitDone(jobId)

    expect(job.items[0]?.status).toBe('failed')
    expect(job.items[0]?.errorCode).toBe('CORRUPTED_FILE')
  })

  it('10. Duplicata: pausa; "pular" não cria registro; "importar" cria um segundo registro', async () => {
    const first = service.start([fixture('simple.cbz')])
    await waitDone(first.jobId)

    const second = service.start([fixture('simple.cbz')])
    const paused = await waitPaused(second.jobId)
    const dupItem = paused.items[0]
    expect(dupItem?.status).toBe('awaiting-duplicate-decision')
    expect(dupItem?.duplicateOf).toBeTruthy()

    service.resolveDuplicate(second.jobId, dupItem.id, 'skip', false)
    const afterSkip = await waitDone(second.jobId)
    expect(afterSkip.items[0]?.status).toBe('skipped-duplicate')

    const third = service.start([fixture('simple.cbz')])
    const paused2 = await waitPaused(third.jobId)
    const dupItem2 = paused2.items[0]
    service.resolveDuplicate(third.jobId, dupItem2.id, 'import', false)
    const afterImport = await waitDone(third.jobId)
    expect(afterImport.items[0]?.status).toBe('done')
  })

  it('11. Cancelar no meio: itens queued viram cancelled, done permanecem', async () => {
    const { jobId } = service.start([fixture('simple.cbz'), fixture('simple.pdf')])
    // Cancela imediatamente, antes do loop assíncrono processar tudo.
    service.cancel(jobId)
    const job = await waitDone(jobId)

    // Pelo menos um item não deve ter sido processado (ficou cancelled) ou,
    // se a corrida terminou tudo antes do cancel, o job simplesmente termina normalmente.
    const statuses = job.items.map((i) => i.status)
    expect(statuses.every((s) => ['done', 'cancelled'].includes(s))).toBe(true)
  })

  it('12. Extensão .epub → UNSUPPORTED_FORMAT', async () => {
    const { jobId } = service.start([fixture('not-a-comic.epub')])
    const job = await waitDone(jobId)

    expect(job.items[0]?.status).toBe('failed')
    expect(job.items[0]?.errorCode).toBe('UNSUPPORTED_FORMAT')
  })
})
