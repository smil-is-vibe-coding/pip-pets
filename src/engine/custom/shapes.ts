import { type Rng, type Vec, r2, smoothClosedPath } from '../core/math'

/** Renderer-agnostic drawable, in the coordinate space of the part it decorates. */
export interface Shape {
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  /** Lets renderers animate special shapes, e.g. 'sun' fades with daylight, 'glow' with night. */
  tag?: 'sun' | 'glow' | 'screen'
}

/** A wobbly round blob (calico patches, spots). */
export function blob(cx: number, cy: number, r: number, rng: Rng, wobble = 0.28, points = 9): string {
  const pts: Vec[] = []
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const rr = r * (1 - wobble / 2 + rng() * wobble)
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
  }
  return smoothClosedPath(pts)
}

/** A tapered stripe from (x1,y1) (thick end) to (x2,y2) (pointy end). */
export function wedge(x1: number, y1: number, x2: number, y2: number, width: number, bend = 0): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const w = width / 2
  const mx = (x1 + x2) / 2 + nx * bend
  const my = (y1 + y2) / 2 + ny * bend
  return (
    `M${r2(x1 + nx * w)} ${r2(y1 + ny * w)}` +
    `Q${r2(mx + nx * w * 0.6)} ${r2(my + ny * w * 0.6)} ${r2(x2)} ${r2(y2)}` +
    `Q${r2(mx - nx * w * 0.6)} ${r2(my - ny * w * 0.6)} ${r2(x1 - nx * w)} ${r2(y1 - ny * w)}Z`
  )
}

export const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r2(cx - rx)} ${r2(cy)}A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx + rx)} ${r2(cy)}A${r2(rx)} ${r2(ry)} 0 1 0 ${r2(cx - rx)} ${r2(cy)}Z`

export const rectPath = (x: number, y: number, w: number, h: number, r = 0) => {
  if (!r) return `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`
  const rr = Math.min(r, w / 2, h / 2)
  return (
    `M${r2(x + rr)} ${r2(y)}H${r2(x + w - rr)}Q${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + rr)}` +
    `V${r2(y + h - rr)}Q${r2(x + w)} ${r2(y + h)} ${r2(x + w - rr)} ${r2(y + h)}` +
    `H${r2(x + rr)}Q${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - rr)}V${r2(y + rr)}Q${r2(x)} ${r2(y)} ${r2(x + rr)} ${r2(y)}Z`
  )
}

export const polyPath = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z'
