import { useEffect, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = pdfWorkerUrl
export function usePdfDocument(fileUrl: string | null): PDFDocumentProxy | null {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  useEffect(() => {
    if (!fileUrl) return
    let cancelled = false
    let task: ReturnType<typeof getDocument> | undefined
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
      void task?.destroy()
    }
  }, [fileUrl])
  return doc
}
