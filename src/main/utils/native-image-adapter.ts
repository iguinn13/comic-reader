import { nativeImage } from 'electron'

/**
 * Único ponto do projeto que chama `nativeImage` diretamente
 * (docs/02-arquitetura.md §3: "serviços não importam electron diretamente,
 * exceto os adaptadores... que são injetados"). O `CoverService` recebe esta
 * função por injeção no construtor, em vez de importá-la, para continuar
 * testável em Node puro.
 *
 * Não há teste automatizado desta função aqui: `nativeImage` só existe
 * dentro de um processo Electron real (main ou renderer), que este ambiente
 * de desenvolvimento sandboxed não consegue executar (não há binário do
 * Electron rodando). A lógica de orquestração que usa esta função
 * (`CoverService`) é testada com uma implementação fake injetada.
 */
export function resizeToJpeg(buffer: Buffer, targetWidth: number, quality: number): Buffer {
  const image = nativeImage.createFromBuffer(buffer)
  const resized = image.resize({ width: targetWidth })
  return resized.toJPEG(quality)
}

/** Tipo da função acima, para injeção no `CoverService`. */
export type ResizeToJpeg = typeof resizeToJpeg
