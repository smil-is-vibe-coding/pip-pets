export interface Vec {
  x: number
  y: number
}

export const DEG = Math.PI / 180
export const TAU = Math.PI * 2

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a))
export const smoothstep = (t: number) => {
  const c = clamp(t)
  return c * c * (3 - 2 * c)
}

/** Frame-rate independent exponential smoothing. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Rounds to 2 decimals for compact SVG path strings. */
export const r2 = (n: number) => Math.round(n * 100) / 100

/** 0 → 1 → 0 bump over t in [0, 1]. */
export const bump = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI))

/**
 * Damped spring integrated with sub-steps so it stays stable at low frame rates.
 * Slightly under-damped by default, which gives the bouncy "cute" settle.
 */
export class Spring {
  value: number
  velocity = 0

  constructor(value: number) {
    this.value = value
  }

  step(target: number, dt: number, stiffness: number, damping: number) {
    let remaining = dt
    while (remaining > 0) {
      const h = Math.min(remaining, 1 / 120)
      const force = (target - this.value) * stiffness - this.velocity * damping
      this.velocity += force * h
      this.value += this.velocity * h
      remaining -= h
    }
    return this.value
  }
}

/** Damping coefficient for a given stiffness and damping ratio (1 = critical). */
export const dampingFor = (stiffness: number, ratio: number) => 2 * Math.sqrt(stiffness) * ratio

// ---------------------------------------------------------------- randomness

/** Small fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export const rand = (min: number, max: number, rng: Rng = Math.random) => min + (max - min) * rng()
export const chance = (p: number, rng: Rng = Math.random) => rng() < p
export const pick = <T>(items: readonly T[], rng: Rng = Math.random): T =>
  items[Math.floor(rng() * items.length)]

export function weightedPick<T>(items: readonly { item: T; weight: number }[], rng: Rng = Math.random): T | null {
  const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const i of items) {
    roll -= Math.max(0, i.weight)
    if (roll <= 0) return i.item
  }
  return items[items.length - 1].item
}

const hash = (n: number, seed: number) => {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(t: number, seed = 0) {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1
}

// ---------------------------------------------------------------- geometry

export const rotate = (p: Vec, angle: number): Vec => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

/** Closed Catmull-Rom spline through points, as an SVG path. */
export function smoothClosedPath(pts: readonly Vec[], tension = 1): string {
  const n = pts.length
  if (n < 3) return ''
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  return d + 'Z'
}

/** Open Catmull-Rom spline through points, as an SVG path. */
export function smoothOpenPath(pts: readonly Vec[]): string {
  const n = pts.length
  if (n < 2) return ''
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    d += `C${r2(p1.x + (p2.x - p0.x) / 6)} ${r2(p1.y + (p2.y - p0.y) / 6)} ${r2(p2.x - (p3.x - p1.x) / 6)} ${r2(p2.y - (p3.y - p1.y) / 6)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  return d
}

/**
 * Superellipse outline points. `n` = 2 is an ellipse, higher is squarer.
 * `shape` lets callers deform each point (cheeks, belly sag, tufts).
 */
export function superellipse(
  rx: number,
  ry: number,
  n: number,
  samples: number,
  shape?: (p: Vec, t: number) => Vec,
): Vec[] {
  const pts: Vec[] = []
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * TAU
    const c = Math.cos(t)
    const s = Math.sin(t)
    const p = {
      x: rx * Math.sign(c) * Math.abs(c) ** (2 / n),
      y: ry * Math.sign(s) * Math.abs(s) ** (2 / n),
    }
    pts.push(shape ? shape(p, t) : p)
  }
  return pts
}

// ---------------------------------------------------------------- color

const parseHex = (hex: string) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')

/** Mix two hex colors. */
export const mixColor = (a: string, b: string, t: number) => {
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex(ca.map((c, i) => lerp(c, cb[i], t)))
}

/** Negative amount darkens, positive lightens. */
export const shade = (hex: string, amount: number) =>
  amount < 0 ? mixColor(hex, '#1a1020', -amount) : mixColor(hex, '#ffffff', amount)
