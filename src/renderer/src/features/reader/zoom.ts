const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_STEP_BELOW_100 = 0.1
const ZOOM_STEP_ABOVE_100 = 0.25
export function stepZoom(current: number, direction: 1 | -1): number {
  const step =
    current < 1 || (current === 1 && direction < 0) ? ZOOM_STEP_BELOW_100 : ZOOM_STEP_ABOVE_100
  const next = Math.round((current + direction * step) * 100) / 100
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
}
const VERTICAL_WIDTH_MIN = 0.2
const VERTICAL_WIDTH_MAX = 1
const VERTICAL_WIDTH_STEP = 0.05
export function stepVerticalWidth(current: number, direction: 1 | -1): number {
  const next = Math.round((current + direction * VERTICAL_WIDTH_STEP) * 100) / 100
  return Math.min(VERTICAL_WIDTH_MAX, Math.max(VERTICAL_WIDTH_MIN, next))
}
