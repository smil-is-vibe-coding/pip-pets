import type { CatGeometry } from '../anim/geometry'
import { shade } from '../core/math'
import { type Shape, ellipsePath } from './shapes'

export interface AccessoryContext {
  g: CatGeometry
  color: string
  color2: string
  outline: string
}

/**
 * An accessory plugin. Shapes are head-local.
 * - `neck`: behind the head (collars, scarves)
 * - `head`: on top of the head, fixed (hats, bows)
 * - `face`: moves with the eyes/nose when the cat looks around (glasses)
 */
export interface Accessory {
  id: string
  label: string
  layer: 'neck' | 'head' | 'face'
  shapes(ctx: AccessoryContext): Shape[]
}

const collar: Accessory = {
  id: 'collar',
  label: 'Collar & bell',
  layer: 'neck',
  shapes({ g, color, color2, outline }) {
    const w = g.headRx
    const h = g.headRy
    const y = h * 0.82
    return [
      { d: `M${-w * 0.62} ${y - 4}Q0 ${y + 14} ${w * 0.62} ${y - 4}`, stroke: outline, strokeWidth: 9 },
      { d: `M${-w * 0.62} ${y - 4}Q0 ${y + 14} ${w * 0.62} ${y - 4}`, stroke: color, strokeWidth: 6 },
      { d: ellipsePath(0, y + 10, 5, 5), fill: color2, stroke: outline, strokeWidth: 1.6 },
      { d: `M-2.5 ${y + 11}H2.5`, stroke: outline, strokeWidth: 1.2 },
    ]
  },
}

const bandana: Accessory = {
  id: 'bandana',
  label: 'Bandana',
  layer: 'neck',
  shapes({ g, color, outline }) {
    const w = g.headRx
    const y = g.headRy * 0.7
    return [
      { d: `M${-w * 0.7} ${y}Q0 ${y + 8} ${w * 0.7} ${y}L${w * 0.1} ${y + 22}Q0 ${y + 25} ${-w * 0.1} ${y + 22}Z`, fill: color, stroke: outline, strokeWidth: 2 },
      { d: ellipsePath(-w * 0.12, y + 9, 1.6, 1.6), fill: shade(color, 0.6) },
      { d: ellipsePath(w * 0.14, y + 7, 1.6, 1.6), fill: shade(color, 0.6) },
      { d: ellipsePath(0, y + 15, 1.6, 1.6), fill: shade(color, 0.6) },
    ]
  },
}

const bow: Accessory = {
  id: 'bow',
  label: 'Bow',
  layer: 'head',
  shapes({ g, color, outline }) {
    const x = g.ear.base.x * 0.9
    const y = -g.headRy * 0.82
    return [
      { d: `M${x} ${y}C${x - 14} ${y - 10} ${x - 14} ${y + 10} ${x} ${y}Z`, fill: color, stroke: outline, strokeWidth: 2 },
      { d: `M${x} ${y}C${x + 14} ${y - 10} ${x + 14} ${y + 10} ${x} ${y}Z`, fill: color, stroke: outline, strokeWidth: 2 },
      { d: ellipsePath(x, y, 3.2, 3.2), fill: shade(color, -0.15), stroke: outline, strokeWidth: 1.6 },
    ]
  },
}

const flower: Accessory = {
  id: 'flower',
  label: 'Flower',
  layer: 'head',
  shapes({ g, color, color2, outline }) {
    const x = -g.ear.base.x * 0.85
    const y = -g.headRy * 0.8
    const petals: Shape[] = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2
      return { d: ellipsePath(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.8, 3.8), fill: color, stroke: outline, strokeWidth: 1.4 }
    })
    return [...petals, { d: ellipsePath(x, y, 2.8, 2.8), fill: color2, stroke: outline, strokeWidth: 1.2 }]
  },
}

const glasses: Accessory = {
  id: 'glasses',
  label: 'Round glasses',
  layer: 'face',
  shapes({ g, color }) {
    const { spacing, y, rx } = g.eye
    const r = rx + 3.5
    return [
      { d: ellipsePath(-spacing, y, r, r), stroke: color, strokeWidth: 2 },
      { d: ellipsePath(spacing, y, r, r), stroke: color, strokeWidth: 2 },
      { d: `M${-spacing + r} ${y - 1}Q0 ${y - 4} ${spacing - r} ${y - 1}`, stroke: color, strokeWidth: 2 },
      { d: ellipsePath(-spacing, y, r - 1, r - 1), fill: '#ffffff', opacity: 0.12 },
      { d: ellipsePath(spacing, y, r - 1, r - 1), fill: '#ffffff', opacity: 0.12 },
    ]
  },
}

const registry = new Map<string, Accessory>()
;[collar, bandana, bow, flower, glasses].forEach((a) => registry.set(a.id, a))

export const registerAccessory = (a: Accessory) => registry.set(a.id, a)
export const getAccessory = (id: string) => registry.get(id)
export const listAccessories = () => [...registry.values()]
