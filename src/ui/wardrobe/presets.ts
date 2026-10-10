import type { AppearanceInput, EarShape, EyeShape, Personality } from '../../engine'

export const COATS: { label: string; look: AppearanceInput }[] = [
  { label: 'Orange tabby', look: { colors: { fur: '#f5a65b', belly: '#fff1dc', innerEar: '#f7b0b4' }, pattern: { id: 'tabby', color: '#d9792f' }, eyes: { color: '#7cc46a' } } },
  { label: 'Black void', look: { colors: { fur: '#2f2a33', belly: '#3d3742', innerEar: '#8a6a7a' }, pattern: { id: 'solid' }, eyes: { color: '#f2c94c' } } },
  { label: 'Tuxedo', look: { colors: { fur: '#2f2a33', belly: '#ffffff', innerEar: '#f0a3b0' }, pattern: { id: 'tuxedo', color: '#fbf7f2', density: 0.7 }, eyes: { color: '#8bd17c' } } },
  { label: 'Calico', look: { colors: { fur: '#fbf4ea', belly: '#ffffff', innerEar: '#f7b0b4' }, pattern: { id: 'calico', color: '#f0a050', color2: '#3b3036', density: 0.6 }, eyes: { color: '#f2a93b' } } },
  { label: 'Siamese', look: { colors: { fur: '#f3e6d3', belly: '#fbf5ec', innerEar: '#f0b8b0' }, pattern: { id: 'colorpoint', color: '#5b4136' }, eyes: { color: '#6fb5ff' } } },
  { label: 'Grey fold', look: { colors: { fur: '#a9b0bd', belly: '#d9dde4', innerEar: '#e8b4bc' }, pattern: { id: 'solid' }, ears: { shape: 'folded' }, eyes: { color: '#f2a93b' }, body: { chubby: 0.8 } } },
  { label: 'Spotted', look: { colors: { fur: '#efd7a8', belly: '#fff6e3', innerEar: '#f7b0b4' }, pattern: { id: 'spotted', color: '#6b4a32', density: 0.6 }, eyes: { color: '#7cc46a' } } },
  { label: 'Snowball', look: { colors: { fur: '#fbfaf7', belly: '#ffffff', innerEar: '#ffc2cc' }, pattern: { id: 'solid' }, eyes: { color: ['#6fb5ff', '#f2c94c'] }, head: { tufts: 1 }, tail: { fluff: 1 } } },
  { label: 'Grey tabby', look: { colors: { fur: '#a7a39c', belly: '#e9e4dc', innerEar: '#e8b4bc' }, pattern: { id: 'tabby', color: '#5f5a55', density: 0.8 }, eyes: { color: '#9bd36a' } } },
]

export const EYE_COLORS = ['#7cc46a', '#f2c94c', '#6fb5ff', '#f2a93b', '#9b7cf0', '#b5804a']

export const PERSONALITIES: { label: string; emoji: string; blurb: string; traits: Partial<Personality> }[] = [
  { label: 'Sleepy Loaf', emoji: '🍞', blurb: 'Naps a lot, very chill.', traits: { lazy: 0.9, playful: 0.25, chaotic: 0.1, cuddly: 0.6, grumpy: 0.15 } },
  { label: 'Velcro', emoji: '🥰', blurb: 'Always wants to be near you.', traits: { cuddly: 1, vocal: 0.7, lazy: 0.4, playful: 0.5, grumpy: 0.05 } },
  { label: 'Gremlin', emoji: '😈', blurb: 'Zoomies. Chaos. Love.', traits: { chaotic: 0.9, playful: 0.9, lazy: 0.2, grumpy: 0.35 } },
  { label: 'Diva', emoji: '👑', blurb: 'Opinionated and fabulous.', traits: { grumpy: 0.7, vocal: 0.85, foodie: 0.75, cuddly: 0.35 } },
  { label: 'Explorer', emoji: '🧭', blurb: 'Climbs everything, curious.', traits: { playful: 0.8, lazy: 0.2, chaotic: 0.5, cuddly: 0.5 } },
]

export const NAMES = ['Mochi', 'Biscuit', 'Miso', 'Pixel', 'Luna', 'Tofu', 'Pumpkin', 'Nori', 'Ziggy', 'Waffles', 'Pepper', 'Bean']

const r = (a: number, b: number) => a + Math.random() * (b - a)
const pickOne = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]

/** A random but always-cute cat. */
export function randomAppearance(): AppearanceInput {
  const coat = pickOne(COATS).look
  const shapes: EarShape[] = ['pointy', 'pointy', 'pointy', 'round', 'folded']
  const eyes: EyeShape[] = ['round', 'round', 'almond', 'sleepy']
  return {
    ...coat,
    body: { chubby: r(0.15, 0.9), length: r(0.88, 1.12), height: 1 },
    head: { size: r(0.94, 1.1), cheeks: r(0.2, 0.9), tufts: r(0, 1), squareness: r(0.15, 0.5) },
    ears: { size: r(0.82, 1.2), shape: coat.ears?.shape ?? pickOne(shapes), spread: r(0.52, 0.64) },
    tail: { length: r(0.8, 1.3), fluff: r(0, 1), thickness: r(0.9, 1.15) },
    legs: { length: r(0.82, 1.15), thickness: 1 },
    eyes: { size: r(0.92, 1.18), shape: pickOne(eyes), color: coat.eyes?.color ?? pickOne(EYE_COLORS), pupil: r(0.62, 0.82), spacing: 1 },
    pattern: { ...coat.pattern, seed: Math.floor(Math.random() * 10000) },
  }
}
