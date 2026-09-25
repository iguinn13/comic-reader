import { useEffect, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Carrega o documento pdf.js de `comic://file/{id}` (docs/06-leitor.md §3.4).
 * O worker vai empacotado localmente (não CDN) para respeitar a CSP sem
 * `script-src` externo. Um documento por `fileUrl` — trocar de HQ recarrega.
 */
export function usePdfDocument(fileUrl: string | null): PDFDocumentProxy | null {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)

  useEffect(() => {
    if (!fileUrl) return

    let cancelled = false
    let task: ReturnType<typeof getDocument> | undefined

    // pdf.js só usa `fetch` internamente para `http(s):` (ver `isValidFetchUrl`
    // no pacote) — para o esquema `comic:` ele cairia no stream via XHR, que o
    // Chromium recusa para esquemas não padrão. Buscamos os bytes nós mesmos
    // (o protocolo já é registrado com `supportFetchAPI: true`) e passamos
    // `data` em vez de `url`, contornando a checagem.
    void fetch(fileUrl)
      .then((res) => res.arrayBuffer())
      .then((data) => {
        if (cancelled) return
        task = getDocument({ data })
        return task.promise.then((loaded) => {
          if (cancelled) {
            void task?.destroy()
            return
          }
          setDoc(loaded)
        })
      })

    return () => {
      cancelled = true
      setDoc(null)
      // `destroy()` cobre os dois casos: tarefa ainda carregando (cancela) ou
      // já resolvida (libera o documento) — só uma chamada, nunca as duas.
      void task?.destroy()
    }
  }, [fileUrl])

  return doc
}
