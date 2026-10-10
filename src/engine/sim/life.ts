import type { PoseOffsets } from '../anim/pose'
import type { Personality } from '../appearance'
import { clamp } from '../core/math'

export interface Needs {
  /** 100 = stuffed, 0 = starving. */
  fullness: number
  /** 100 = well watered. */
  hydration: number
  energy: number
  affection: number
  fun: number
}

export type Mood = 'happy' | 'content' | 'playful' | 'sleepy' | 'hungry' | 'thirsty' | 'grumpy' | 'lonely'

export interface LifeState {
  needs: Needs
  asleep: boolean
  /** Short-term irritation from over-petting/boops, 0 – 100; decays quickly. */
  annoyance: number
  /** Slow random drift in -1 – 1: the cat's "mood swings". */
  temper: number
}

export const createLife = (needs?: Partial<Needs>): LifeState => ({
  needs: { fullness: 80, hydration: 85, energy: 85, affection: 65, fun: 60, ...needs },
  asleep: false,
  annoyance: 0,
  temper: 0,
})

const HOUR = 3600

/** Per-second change of each need given the cat's personality and state. */
function rates(p: Personality, asleep: boolean): Needs {
  return {
    fullness: (-(9 + p.foodie * 9) / HOUR) * (asleep ? 0.5 : 1),
    hydration: (-14 / HOUR) * (asleep ? 0.4 : 1),
    energy: asleep ? (55 + p.lazy * 15) / HOUR : -(7 + p.lazy * 9 + p.playful * 3) / HOUR,
    affection: (-(4 + p.cuddly * 8) / HOUR) * (asleep ? 0.3 : 1),
    fun: asleep ? -2 / HOUR : -(9 + p.playful * 12) / HOUR,
  }
}

const gaussian = () => {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Advances needs by `dt` seconds of (optionally accelerated) time. */
export function advanceLife(s: LifeState, p: Personality, dt: number) {
  const r = rates(p, s.asleep)
  const n = s.needs
  n.fullness = clamp(n.fullness + r.fullness * dt, 0, 100)
  n.hydration = clamp(n.hydration + r.hydration * dt, 0, 100)
  n.energy = clamp(n.energy + r.energy * dt, 0, 100)
  n.affection = clamp(n.affection + r.affection * dt, 0, 100)
  n.fun = clamp(n.fun + r.fun * dt, 0, 100)
  s.annoyance = Math.max(0, s.annoyance - dt * (1.6 - p.grumpy))
  // Ornstein-Uhlenbeck drift: chaotic cats swing harder and more often.
  const vol = 0.02 + p.chaotic * 0.06
  s.temper = clamp(s.temper - s.temper * 0.01 * dt + gaussian() * vol * Math.sqrt(Math.min(dt, 5)), -1, 1)
}

/**
 * Catch up on time spent with the page closed. Sleeps when tired, wakes when
 * rested, and never lets needs drop below a gentle floor: the cat sulks, it doesn't suffer.
 */
export function catchUpLife(s: LifeState, p: Personality, seconds: number) {
  const total = Math.min(seconds, 3 * 24 * HOUR)
  const step = 60
  for (let t = 0; t < total; t += step) {
    if (!s.asleep && s.needs.energy < 25) s.asleep = true
    else if (s.asleep && s.needs.energy > 92) s.asleep = false
    advanceLife(s, p, Math.min(step, total - t))
  }
  const n = s.needs
  n.fullness = Math.max(n.fullness, 8)
  n.hydration = Math.max(n.hydration, 10)
  n.affection = Math.max(n.affection, 10)
  n.fun = Math.max(n.fun, 10)
  s.annoyance = 0
}

export function deriveMood(s: LifeState, p: Personality): Mood {
  const n = s.needs
  if (s.annoyance > 50 || (s.temper < -0.65 && p.grumpy > 0.35)) return 'grumpy'
  if (n.fullness < 25) return 'hungry'
  if (n.hydration < 22) return 'thirsty'
  if (n.energy < 22) return 'sleepy'
  if (n.affection < 28) return 'lonely'
  if (n.energy > 55 && n.fun < 45 + p.playful * 15) return 'playful'
  const avg = (n.fullness + n.hydration + n.energy + n.affection + n.fun) / 5
  if (avg + s.temper * 15 > 70) return 'happy'
  return 'content'
}

/** How each mood shows up in body language, layered on top of any pose. */
export const MOOD_STYLES: Record<Mood, PoseOffsets> = {
  happy: { tailAngle: 14, tailCurl: 4, earL: -4, earR: -4, blush: 0.25 },
  content: {},
  playful: { pupil: 0.3, tailSway: 7, tailSpeed: 0.35, earL: -7, earR: -7, tailAngle: 10 },
  sleepy: { eyeOpen: -0.38, earL: 9, earR: 9, tailAngle: -15, tailSway: -3, tailSpeed: -0.1 },
  hungry: { earL: 6, earR: 6, tailAngle: -10, pupil: 0.15 },
  thirsty: { earL: 6, earR: 6, tailAngle: -12, tongue: 0.15 },
  grumpy: { earL: 26, earR: 26, earFlat: 0.5, eyeOpen: -0.32, tailAngle: -22, tailSway: 10, tailSpeed: 0.9, whisker: -7, blush: -0.6 },
  lonely: { earL: 12, earR: 12, tailAngle: -25, tailSway: -4, blush: -0.3, headY: 2 },
}

// ---------------------------------------------------------------- hints

export type HintLevel = 0 | 1 | 2 | 3

/** Thresholds for subtle (1), clear (2) and asking (3) hints per need. */
const HINT_THRESHOLDS: Record<keyof Needs, [number, number, number]> = {
  fullness: [50, 35, 20],
  hydration: [50, 35, 20],
  energy: [35, 22, 12],
  affection: [50, 35, 20],
  fun: [50, 32, 18],
}

export function hintLevel(need: keyof Needs, value: number): HintLevel {
  const [a, b, c] = HINT_THRESHOLDS[need]
  return value < c ? 3 : value < b ? 2 : value < a ? 1 : 0
}

export interface Hint {
  need: keyof Needs
  level: HintLevel
}

/** The most urgent need right now (highest level; ties go to the lowest value). */
export function topHint(needs: Needs): Hint | null {
  let best: Hint | null = null
  let bestValue = Infinity
  for (const need of Object.keys(HINT_THRESHOLDS) as (keyof Needs)[]) {
    const level = hintLevel(need, needs[need])
    if (level === 0) continue
    if (!best || level > best.level || (level === best.level && needs[need] < bestValue)) {
      best = { need, level }
      bestValue = needs[need]
    }
  }
  return best
}
