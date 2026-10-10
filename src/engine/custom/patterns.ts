import type { CatGeometry } from '../anim/geometry'
import { type Rng, createRng } from '../core/math'
import { type Shape, blob, ellipsePath, wedge } from './shapes'

export interface PatternContext {
  g: CatGeometry
  color: string
  color2: string
  /** 0 – 1 */
  density: number
  rng: Rng
}

/**
 * A coat pattern plugin. Shapes are in part-local coordinates and are clipped
 * to that part's silhouette by the renderer, so they can safely overflow.
 */
export interface CoatPattern {
  id: string
  label: string
  /** Draw the default light belly patch underneath the pattern (default true). */
  belly?: boolean
  body?(ctx: PatternContext): Shape[]
  head?(ctx: PatternContext): Shape[]
  /** Color for the lower legs/paws ("socks"). */
  paws?(ctx: PatternContext): string | null
  /** Recolor the whole tail. */
  tail?(ctx: PatternContext): string | null
  tailTip?(ctx: PatternContext): string | null
  /** Recolor the outer ears. */
  ears?(ctx: PatternContext): string | null
}

const solid: CoatPattern = { id: 'solid', label: 'Solid' }

const tabby: CoatPattern = {
  id: 'tabby',
  label: 'Tabby',
  body({ g, color, density, rng }) {
    const rx = g.bodyRx
    const ry = g.bodyRy
    const count = Math.round(3 + density * 4)
    const shapes: Shape[] = []
    for (let i = 0; i < count; i++) {
      const x = -rx * 0.8 + (i / (count - 1)) * rx * 1.35
      const depth = ry * (0.7 + rng() * 0.45)
      shapes.push({ d: wedge(x, -ry - 3, x - 4 + rng() * 3, -ry + depth, 7 + density * 2, rng() * 4 - 2), fill: color })
    }
    return shapes
  },
  head({ g, color, density }) {
    const w = g.headRx
    const h = g.headRy
    const top = -h - 2
    const s = 3.6 + density * 1.4
    return [
      // The classic forehead "M".
      { d: wedge(0, top, 0, -h * 0.45, s), fill: color },
      { d: wedge(-w * 0.22, top + 2, -w * 0.15, -h * 0.5, s, -1), fill: color },
      { d: wedge(w * 0.22, top + 2, w * 0.15, -h * 0.5, s, 1), fill: color },
      // Cheek stripes.
      { d: wedge(-w - 3, h * 0.12, -w * 0.62, h * 0.18, s), fill: color },
      { d: wedge(-w - 3, h * 0.38, -w * 0.68, h * 0.38, s), fill: color },
      { d: wedge(w + 3, h * 0.12, w * 0.62, h * 0.18, s), fill: color },
      { d: wedge(w + 3, h * 0.38, w * 0.68, h * 0.38, s), fill: color },
    ]
  },
  tailTip: ({ color }) => color,
}

const tuxedo: CoatPattern = {
  id: 'tuxedo',
  label: 'Tuxedo',
  belly: false,
  body({ g, color, density }) {
    const rx = g.bodyRx
    const ry = g.bodyRy
    return [{ d: ellipsePath(rx * 0.42, ry * 0.45, rx * (0.45 + density * 0.2), ry * (0.6 + density * 0.2)), fill: color }]
  },
  head({ g, color, density }) {
    const w = g.headRx
    const h = g.headRy
    const shapes: Shape[] = [{ d: ellipsePath(0, h * 0.55, w * 0.42, h * 0.42), fill: color }]
    if (density > 0.4) shapes.push({ d: wedge(0, h * 0.3, 0, -h * 0.55, 9 * density), fill: color })
    return shapes
  },
  paws: ({ color }) => color,
}

const calico: CoatPattern = {
  id: 'calico',
  label: 'Calico',
  body({ g, color, color2, density, rng }) {
    const rx = g.bodyRx
    const ry = g.bodyRy
    const count = Math.round(2 + density * 4)
    const shapes: Shape[] = []
    for (let i = 0; i < count; i++) {
      const x = -rx + rng() * rx * 1.8
      const y = -ry * 0.9 + rng() * ry * 1.1
      shapes.push({ d: blob(x, y, ry * (0.35 + rng() * 0.45 + density * 0.2), rng), fill: i % 2 ? color2 : color })
    }
    return shapes
  },
  head({ g, color, color2, rng }) {
    const w = g.headRx
    const h = g.headRy
    const left = rng() > 0.5
    return [
      { d: blob(left ? -w * 0.75 : w * 0.75, -h * 0.55, w * 0.55, rng), fill: color },
      { d: blob(left ? w * 0.8 : -w * 0.8, -h * 0.7, w * 0.42, rng), fill: color2 },
    ]
  },
  tailTip: ({ color2 }) => color2,
}

const colorpoint: CoatPattern = {
  id: 'colorpoint',
  label: 'Colorpoint',
  head({ g, color }) {
    const h = g.headRy
    return [{ d: ellipsePath(0, h * 0.42, g.headRx * 0.52, h * 0.48), fill: color, opacity: 0.85 }]
  },
  paws: ({ color }) => color,
  tail: ({ color }) => color,
  ears: ({ color }) => color,
}

const spotted: CoatPattern = {
  id: 'spotted',
  label: 'Spotted',
  body({ g, color, density, rng }) {
    const shapes: Shape[] = []
    const count = Math.round(5 + density * 10)
    for (let i = 0; i < count; i++) {
      const x = -g.bodyRx + rng() * g.bodyRx * 1.9
      const y = -g.bodyRy + rng() * g.bodyRy * 1.2
      shapes.push({ d: blob(x, y, 3 + rng() * 3.5, rng), fill: color })
    }
    return shapes
  },
  head({ g, color, rng }) {
    return [0, 1, 2].map(() => ({ d: blob((rng() - 0.5) * g.headRx * 0.7, -g.headRy * (0.55 + rng() * 0.3), 2.5 + rng() * 2, rng), fill: color }))
  },
}

const registry = new Map<string, CoatPattern>()
;[solid, tabby, tuxedo, calico, colorpoint, spotted].forEach((p) => registry.set(p.id, p))

export const registerPattern = (p: CoatPattern) => registry.set(p.id, p)
export const getPattern = (id: string) => registry.get(id) ?? solid
export const listPatterns = () => [...registry.values()]

/** Resolves the current appearance's pattern into concrete shapes and colors. */
export function resolvePattern(g: CatGeometry) {
  const cfg = g.appearance.pattern
  const p = getPattern(cfg.id)
  // Each part gets its own seeded stream so editing one doesn't reshuffle another.
  const ctx = (salt: number): PatternContext => ({ g, color: cfg.color, color2: cfg.color2, density: cfg.density, rng: createRng(cfg.seed * 997 + salt) })
  return {
    belly: p.belly ?? true,
    body: p.body?.(ctx(1)) ?? [],
    head: p.head?.(ctx(2)) ?? [],
    paws: p.paws?.(ctx(3)) ?? null,
    tail: p.tail?.(ctx(4)) ?? null,
    tailTip: p.tailTip?.(ctx(5)) ?? null,
    ears: p.ears?.(ctx(6)) ?? null,
  }
}
