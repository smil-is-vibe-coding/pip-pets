import { type Vec, rand } from './core/math'

export type ParticleKind = 'heart' | 'z' | 'sparkle' | 'puff' | 'note' | 'anger' | 'crumb' | 'exclaim' | 'thought'
export type ThoughtIcon = 'fish' | 'heart' | 'yarn' | 'moon' | 'water'

export interface Particle {
  id: number
  kind: ParticleKind
  icon?: ThoughtIcon
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  rot: number
  vr: number
  /** 0 – 1, computed each update for renderers (fade/pop curves). */
  alpha: number
  scale: number
}

interface SpawnOptions {
  icon?: ThoughtIcon
  size?: number
  life?: number
  vx?: number
  vy?: number
}

const DEFAULTS: Record<ParticleKind, { life: number; size: number; vy: number; gravity: number }> = {
  heart: { life: 1.6, size: 1, vy: -26, gravity: 0 },
  z: { life: 2.4, size: 1, vy: -14, gravity: 0 },
  sparkle: { life: 0.9, size: 1, vy: -6, gravity: 0 },
  puff: { life: 0.7, size: 1, vy: -8, gravity: 0 },
  note: { life: 1.6, size: 1, vy: -20, gravity: 0 },
  anger: { life: 1.1, size: 1, vy: 0, gravity: 0 },
  crumb: { life: 0.8, size: 1, vy: -30, gravity: 160 },
  exclaim: { life: 0.9, size: 1, vy: 0, gravity: 0 },
  thought: { life: 2.6, size: 1, vy: -3, gravity: 0 },
}

/** Purely data-driven particle system; renderers draw `list`. */
export class Effects {
  readonly list: Particle[] = []
  private nextId = 1

  spawn(kind: ParticleKind, at: Vec, opts: SpawnOptions = {}) {
    const d = DEFAULTS[kind]
    const p: Particle = {
      id: this.nextId++,
      kind,
      icon: opts.icon,
      x: at.x,
      y: at.y,
      vx: opts.vx ?? (kind === 'z' ? rand(6, 12) : kind === 'crumb' ? rand(-30, 30) : rand(-8, 8)),
      vy: opts.vy ?? d.vy,
      age: 0,
      life: opts.life ?? d.life,
      size: opts.size ?? d.size,
      rot: kind === 'z' ? rand(-15, 5) : rand(-12, 12),
      vr: kind === 'sparkle' ? rand(-90, 90) : 0,
      alpha: 0,
      scale: 0,
    }
    // Only one thought bubble at a time.
    if (kind === 'thought') this.clear('thought')
    this.list.push(p)
    return p
  }

  clear(kind?: ParticleKind) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!kind || this.list[i].kind === kind) this.list.splice(i, 1)
    }
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]
      p.age += dt
      if (p.age >= p.life) {
        this.list.splice(i, 1)
        continue
      }
      const t = p.age / p.life
      p.vy += DEFAULTS[p.kind].gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      if (p.kind === 'heart' || p.kind === 'note') p.x += Math.sin(p.age * 6 + p.id) * 8 * dt
      // Pop in, hold, fade out.
      const pop = Math.min(1, p.age / 0.18)
      p.scale = p.size * (p.kind === 'puff' ? 0.6 + t * 0.9 : p.kind === 'z' ? 0.6 + t * 0.6 : 1 - Math.pow(1 - pop, 3) + Math.sin(pop * Math.PI) * 0.25)
      p.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
    }
  }
}
