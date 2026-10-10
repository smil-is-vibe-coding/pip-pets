import { chance, clamp, pick, rand } from '../core/math'
import { planRoute } from './nav'
import { type Sky, hourOf, skyAt } from './time'
import type { SceneDef, Spot, SpotKind, Surface } from './types'

export type FoodKind = 'kibble' | 'fish' | 'treat'

export interface Bird {
  id: number
  x: number
  y: number
  age: number
  stay: number
  /** > 0 while flying away. */
  leaving: number
  facing: 1 | -1
}

export interface Butterfly {
  id: number
  x: number
  y: number
  baseY: number
  dir: 1 | -1
  phase: number
  speed: number
  scared: number
  color: string
}

const BUTTERFLY_COLORS = ['#ff9fd0', '#ffd34e', '#9fd8ff', '#c7a6ff']

/** Runtime state of a scene: props, ambient critters, time of day, spot bookkeeping. */
export class World {
  def: SceneDef
  surfaces: Surface[] = []
  readonly bowl = { food: 0, value: 6, kind: 'kibble' as FoodKind }
  /** Water bowl fill, 0 – 1. */
  water = 1
  readonly yarn = { x: 0, vx: 0, spin: 0 }
  birds: Bird[] = []
  butterflies: Butterfly[] = []
  /** Force a time of day (fractional hour) — for previews and screenshots. */
  hourOverride: number | null = null
  private visited = new Map<string, number>()
  private clock = 0
  private nextBird = rand(8, 25)
  private nextId = 1

  constructor(def: SceneDef) {
    this.def = def
    this.setScene(def)
  }

  setScene(def: SceneDef) {
    this.def = def
    this.surfaces = [{ id: 'floor', x0: 0, x1: def.width, y: 0 }, ...def.surfaces]
    const toys = this.spotOf('toys')
    this.yarn.x = toys ? toys.x + 30 : def.width * 0.6
    this.yarn.vx = 0
    this.birds = []
    this.butterflies = Array.from({ length: def.ambient?.butterflies ?? 0 }, () => this.makeButterfly())
    this.visited.clear()
  }

  get width() {
    return this.def.width
  }

  // ---------------------------------------------------------------- time

  hour() {
    return this.hourOverride ?? hourOf(new Date())
  }

  sky(): Sky {
    return skyAt(this.hour())
  }

  isDaytime() {
    const h = this.hour()
    return h >= 7 && h < 19
  }

  // ---------------------------------------------------------------- spots

  surface(id: string) {
    return this.surfaces.find((s) => s.id === id) ?? this.surfaces[0]
  }

  spot(id: string) {
    return this.def.spots.find((s) => s.id === id)
  }

  spotOf(kind: SpotKind) {
    return this.def.spots.find((s) => s.kind === kind)
  }

  /** A usable spot of a kind, preferring ones the cat hasn't visited lately. */
  pickSpot(kind: SpotKind | SpotKind[], avoidRecentSec = 60): Spot | undefined {
    const kinds = Array.isArray(kind) ? kind : [kind]
    const all = this.def.spots.filter((s) => kinds.includes(s.kind) && (!s.daytimeOnly || this.isDaytime()))
    const fresh = all.filter((s) => this.clock - (this.visited.get(s.id) ?? -1e9) > avoidRecentSec)
    return pick(fresh.length ? fresh : all) ?? undefined
  }

  /** Any spot, for exploring. */
  randomSpot(exclude?: string): Spot | undefined {
    const options = this.def.spots.filter((s) => s.id !== exclude && (!s.daytimeOnly || this.isDaytime()))
    const fresh = options.filter((s) => this.clock - (this.visited.get(s.id) ?? -1e9) > 90)
    return pick(fresh.length ? fresh : options) ?? undefined
  }

  markVisited(spotId: string) {
    this.visited.set(spotId, this.clock)
  }

  route(from: { surface: string; x: number }, to: { surface: string; x: number }) {
    return planRoute(this.surfaces, from, to)
  }

  // ---------------------------------------------------------------- props

  fill(kind: FoodKind, units: number, value: number) {
    this.bowl.kind = kind
    this.bowl.value = value
    this.bowl.food = Math.min(12, this.bowl.food + units)
  }

  kickYarn(dir: number, strength = 1) {
    this.yarn.vx += dir * rand(120, 190) * strength
  }

  // ---------------------------------------------------------------- ambient

  private makeButterfly(): Butterfly {
    const baseY = rand(-110, -45)
    return {
      id: this.nextId++,
      x: rand(40, this.def.width - 40),
      y: baseY,
      baseY,
      dir: chance(0.5) ? 1 : -1,
      phase: rand(0, 6),
      speed: rand(16, 30),
      scared: 0,
      color: pick(BUTTERFLY_COLORS),
    }
  }

  /** Startle critters near a point (after a pounce). */
  startle(x: number, y: number, radius = 45) {
    for (const b of this.butterflies) {
      if (Math.hypot(b.x - x, b.y - y) < radius) {
        b.scared = 1.6
        b.dir = b.x > x ? 1 : -1
      }
    }
    for (const b of this.birds) if (Math.abs(b.x - x) < radius * 2 && !b.leaving) b.leaving = 0.01
  }

  update(dt: number) {
    this.clock += dt

    // Yarn ball rolls with friction and bounces off walls.
    const y = this.yarn
    y.x += y.vx * dt
    y.spin += y.vx * dt
    y.vx *= Math.exp(-2.2 * dt)
    if (Math.abs(y.vx) < 2) y.vx = 0
    if (y.x < 12 || y.x > this.def.width - 12) {
      y.x = clamp(y.x, 12, this.def.width - 12)
      y.vx *= -0.6
    }

    // Birds visit windows/fences now and then.
    const perches = this.def.ambient?.birds ? this.def.art.windows.flatMap((w) => w.perches ?? []) : []
    if (perches.length) {
      this.nextBird -= dt
      if (this.nextBird <= 0 && this.birds.length < 2) {
        const p = pick(perches)
        this.birds.push({ id: this.nextId++, x: p.x, y: p.y, age: 0, stay: rand(14, 35), leaving: 0, facing: chance(0.5) ? 1 : -1 })
        this.nextBird = rand(30, 90)
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i]
      b.age += dt
      if (!b.leaving && b.age > b.stay) b.leaving = 0.01
      if (b.leaving) {
        b.leaving += dt
        b.x += b.facing * 90 * dt
        b.y -= 70 * dt
        if (b.leaving > 1.5) this.birds.splice(i, 1)
      } else if (chance(dt * 0.4)) b.facing = b.facing === 1 ? -1 : 1
    }

    for (const b of this.butterflies) {
      b.phase += dt * (b.scared > 0 ? 14 : 8)
      const speed = b.speed * (b.scared > 0 ? 3.2 : 1)
      b.x += b.dir * speed * dt
      if (b.scared > 0) {
        b.scared -= dt
        b.baseY = Math.max(-150, b.baseY - 50 * dt)
      } else {
        b.baseY += (rand(-1, 1) * 30 - (b.baseY + 75) * 0.2) * dt
        if (chance(dt * 0.15)) b.dir = b.dir === 1 ? -1 : 1
      }
      if (b.x < 20) b.dir = 1
      if (b.x > this.def.width - 20) b.dir = -1
      b.y = b.baseY + Math.sin(b.phase * 0.35) * 10
    }
  }
}
