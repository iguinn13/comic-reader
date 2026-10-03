import { nativeImage } from 'electron'
export function resizeToJpeg(buffer: Buffer, targetWidth: number, quality: number): Buffer {
  const image = nativeImage.createFromBuffer(buffer)
  const resized = image.resize({ width: targetWidth })
  return resized.toJPEG(quality)
}
export type ResizeToJpeg = typeof resizeToJpeg
