/**
 * The customization contract. Everything a customizer UI edits lives here;
 * the renderer rebuilds geometry from it, so any change is plug-and-play.
 * Multipliers are ~1 at default and sensible within roughly 0.6 – 1.5.
 */

export type EarShape = 'pointy' | 'round' | 'folded'
export type EyeShape = 'round' | 'almond' | 'sleepy'

export interface CatAppearance {
  /** Overall scale of the cat. */
  size: number
  body: {
    length: number
    height: number
    /** 0 = sleek, 1 = very round with belly sag. */
    chubby: number
  }
  head: {
    size: number
    /** Superellipse exponent bias: 0 = oval, 1 = squarish. */
    squareness: number
    /** Cheek width bulge, 0 – 1. */
    cheeks: number
    /** Fur tufts at the cheeks, 0 – 1. */
    tufts: number
  }
  ears: {
    size: number
    shape: EarShape
    /** How far apart the ears sit, ~0.4 – 0.75. */
    spread: number
  }
  legs: {
    length: number
    thickness: number
  }
  tail: {
    length: number
    thickness: number
    /** Mid-tail bulge, 0 – 1. */
    fluff: number
  }
  eyes: {
    size: number
    /** Half-distance multiplier between the eyes. */
    spacing: number
    shape: EyeShape
    /** Iris color, or [left, right] for heterochromia. */
    color: string | [string, string]
    /** Resting pupil size, 0.3 – 1. */
    pupil: number
  }
  face: {
    whiskers: number
    blush: number
  }
  colors: {
    fur: string
    /** Used for far-side legs; derived from fur when omitted. */
    furShade?: string
    belly: string
    outline: string
    innerEar: string
    nose: string
    blush: string
  }
  /** Coat pattern plugin id + its options (see render/patterns). */
  pattern: {
    id: string
    color: string
    /** Secondary color for multi-color patterns (calico). */
    color2: string
    seed: number
    /** 0 – 1, how much of the coat the pattern covers. */
    density: number
  }
  /** Outline stroke width in world units (0 = no outline). */
  outline: number
  accessories: AccessoryConfig[]
}

export interface AccessoryConfig {
  id: string
  color: string
  color2?: string
}

export interface Personality {
  /** 0 = couch potato, 1 = always wants to play. */
  playful: number
  /** Sleeps more and gets tired faster. */
  lazy: number
  /** Wants affection, enjoys petting longer. */
  cuddly: number
  /** Mood swings, zoomies, random chaos. */
  chaotic: number
  /** Gets hungry faster and begs more. */
  foodie: number
  /** Meows more. */
  vocal: number
  /** Low tolerance for petting and boops. */
  grumpy: number
}

export const DEFAULT_APPEARANCE: CatAppearance = {
  size: 1,
  body: { length: 1, height: 1, chubby: 0.45 },
  head: { size: 1, squareness: 0.35, cheeks: 0.5, tufts: 0.4 },
  ears: { size: 1, shape: 'pointy', spread: 0.58 },
  legs: { length: 1, thickness: 1 },
  tail: { length: 1, thickness: 1, fluff: 0.35 },
  eyes: { size: 1, spacing: 1, shape: 'round', color: '#7cc46a', pupil: 0.72 },
  face: { whiskers: 1, blush: 0.55 },
  colors: {
    fur: '#f5a65b',
    belly: '#fff1dc',
    outline: '#4a2f27',
    innerEar: '#f7b0b4',
    nose: '#f0849a',
    blush: '#ff8fa3',
  },
  pattern: { id: 'tabby', color: '#d9792f', color2: '#3a2a26', seed: 7, density: 0.6 },
  outline: 4.5,
  accessories: [{ id: 'collar', color: '#e8505b', color2: '#ffd34e' }],
}

export const DEFAULT_PERSONALITY: Personality = {
  playful: 0.6,
  lazy: 0.4,
  cuddly: 0.6,
  chaotic: 0.35,
  foodie: 0.5,
  vocal: 0.5,
  grumpy: 0.25,
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] }
export type AppearanceInput = DeepPartial<CatAppearance>

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return (patch ?? base) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v
  }
  return out as T
}

/** Fills in defaults, or applies a partial change on top of `base`. */
export const resolveAppearance = (input?: AppearanceInput, base: CatAppearance = DEFAULT_APPEARANCE): CatAppearance =>
  deepMerge(base, input)

export const resolvePersonality = (input?: Partial<Personality>): Personality => ({
  ...DEFAULT_PERSONALITY,
  ...input,
})
