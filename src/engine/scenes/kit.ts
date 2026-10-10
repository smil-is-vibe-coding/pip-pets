import { shade } from '../core/math'
import { type Shape, ellipsePath, polyPath, rectPath } from '../custom/shapes'

/** Shared furniture outline color and width for the sticker style. */
export const INK = '#5a4038'
export const LINE = 3

export const fillOnly = (d: string, fill: string, opacity?: number): Shape => ({ d, fill, opacity })
export const solid = (d: string, fill: string, sw = LINE): Shape => ({ d, fill, stroke: INK, strokeWidth: sw })
export const line = (d: string, stroke = INK, sw = LINE, opacity?: number): Shape => ({ d, stroke, strokeWidth: sw, opacity })

export const rect = (x: number, y: number, w: number, h: number, fill: string, r = 3, sw = LINE) => solid(rectPath(x, y, w, h, r), fill, sw)
export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, sw = LINE) => solid(ellipsePath(cx, cy, rx, ry), fill, sw)
export const poly = (pts: [number, number][], fill: string, sw = LINE) => solid(polyPath(pts), fill, sw)

/** Wall + floor backdrop that extends well past the scene edges (for wide/tall viewports). */
export function room(width: number, wall: string, floor: string, opts: { stripes?: string; wainscot?: string } = {}): Shape[] {
  const shapes: Shape[] = [fillOnly(rectPath(-600, -900, width + 1200, 900), wall)]
  if (opts.stripes) {
    for (let x = -600; x < width + 600; x += 46) shapes.push(fillOnly(rectPath(x, -900, 18, 890), opts.stripes, 0.35))
  }
  if (opts.wainscot) {
    shapes.push(fillOnly(rectPath(-600, -74, width + 1200, 74), opts.wainscot))
    shapes.push(line(`M-600 -74H${width + 600}`, shade(opts.wainscot, -0.15), 3))
  }
  shapes.push(fillOnly(rectPath(-600, -10, width + 1200, 10), shade(wall, -0.12)))
  shapes.push(fillOnly(rectPath(-600, 0, width + 1200, 400), floor))
  shapes.push(line(`M-600 0H${width + 600}`, shade(floor, -0.25), 3))
  for (let x = -600; x < width + 600; x += 120) shapes.push(line(`M${x} 14L${x + 40} 14`, shade(floor, -0.12), 2, 0.7))
  return shapes
}

/** A window frame with curtains; the sky inside is drawn by the renderer. */
export function windowFrame(x: number, y: number, w: number, h: number, curtain = '#f4a7b9'): Shape[] {
  const frame = '#fff8f0'
  return [
    line(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h * 0.48}H${x + w}`, INK, 9),
    line(`M${x + w / 2} ${y}V${y + h}M${x} ${y + h * 0.48}H${x + w}`, frame, 5),
    { d: rectPath(x, y, w, h, 4), stroke: INK, strokeWidth: 12 },
    { d: rectPath(x, y, w, h, 4), stroke: frame, strokeWidth: 7 },
    solid(`M${x - 22} ${y - 12}Q${x - 6} ${y + h * 0.4} ${x - 18} ${y + h + 4}L${x + 8} ${y + h + 4}Q${x + 2} ${y + h * 0.5} ${x + 14} ${y - 12}Z`, curtain),
    solid(`M${x + w + 22} ${y - 12}Q${x + w + 6} ${y + h * 0.4} ${x + w + 18} ${y + h + 4}L${x + w - 8} ${y + h + 4}Q${x + w - 2} ${y + h * 0.5} ${x + w - 14} ${y - 12}Z`, curtain),
    rect(x - 34, y - 18, w + 68, 8, '#d9b38c', 3),
  ]
}

export function plant(x: number, base: number, scale = 1, pot = '#e07a5f'): Shape[] {
  const s = scale
  const leaf = (dx: number, dy: number, rot: number, len: number): Shape =>
    solid(`M${x} ${base - 26 * s}Q${x + dx * 0.4 - rot} ${base - 26 * s + dy * 0.6} ${x + dx} ${base - 26 * s + dy}Q${x + dx * 0.7 + rot} ${base - 26 * s + dy * 0.3} ${x} ${base - 26 * s}Z`, len > 1 ? '#6fbf73' : '#5aa860', 2.5)
  return [
    leaf(-26 * s, -34 * s, 6, 1),
    leaf(24 * s, -38 * s, -6, 1),
    leaf(-6 * s, -50 * s, 4, 2),
    leaf(12 * s, -28 * s, -4, 2),
    poly([[x - 16 * s, base - 28 * s], [x + 16 * s, base - 28 * s], [x + 12 * s, base], [x - 12 * s, base]], pot, 2.5),
    rect(x - 18 * s, base - 32 * s, 36 * s, 7 * s, shade(pot, -0.1), 2, 2.5),
  ]
}

export function books(x: number, base: number): Shape[] {
  const colors = ['#e8505b', '#5cc8a8', '#ffd34e', '#7aa7ff']
  return colors.map((c, i) => rect(x + i * 9, base - 26 + (i % 2) * 4, 8, 26 - (i % 2) * 4, c, 1.5, 2))
}

export function basket(x: number, base: number): Shape[] {
  return [
    ellipse(x - 8, base - 24, 7, 7, '#7aa7ff', 2),
    ellipse(x + 8, base - 26, 6, 6, '#ff9fd0', 2),
    poly([[x - 24, base - 22], [x + 24, base - 22], [x + 19, base], [x - 19, base]], '#d9a35e', 2.5),
    line(`M${x - 21} ${base - 14}H${x + 21}M${x - 20} ${base - 7}H${x + 20}`, '#b07a3e', 2),
  ]
}

export function lampGlowShape(x: number, y: number, r: number): Shape {
  return { d: ellipsePath(x, y, r, r * 0.8), fill: '#ffd38a', opacity: 0, tag: 'glow' }
}
