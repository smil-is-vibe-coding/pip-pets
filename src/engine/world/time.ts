import { lerp, mixColor } from '../core/math'

export interface Sky {
  top: string
  bottom: string
  /** Tint laid over the whole scene. */
  tint: string
  tintOpacity: number
  /** 0 – 1: how "night" it is (lamp glow, stars). */
  night: number
  /** 0 – 1: sunlight strength (sun patches). */
  sun: number
}

// Keyframes by hour of day.
const KEYS: { h: number; top: string; bottom: string; tint: string; tintOpacity: number; night: number; sun: number }[] = [
  { h: 0, top: '#151a40', bottom: '#2e3470', tint: '#1b2260', tintOpacity: 0.24, night: 1, sun: 0 },
  { h: 5, top: '#2a2f66', bottom: '#8a7fb8', tint: '#2a2a60', tintOpacity: 0.26, night: 0.8, sun: 0 },
  { h: 7, top: '#ffc59e', bottom: '#ffe9c9', tint: '#ffb070', tintOpacity: 0.08, night: 0.1, sun: 0.5 },
  { h: 10, top: '#8fcfff', bottom: '#dff3ff', tint: '#ffffff', tintOpacity: 0, night: 0, sun: 1 },
  { h: 15, top: '#86c8ff', bottom: '#e6f5ff', tint: '#ffffff', tintOpacity: 0, night: 0, sun: 1 },
  { h: 18, top: '#ff9b78', bottom: '#ffd4a0', tint: '#ff8a50', tintOpacity: 0.1, night: 0.1, sun: 0.6 },
  { h: 20, top: '#4e4f92', bottom: '#c08fb5', tint: '#3a3070', tintOpacity: 0.16, night: 0.6, sun: 0 },
  { h: 22, top: '#181d48', bottom: '#30366f', tint: '#1b2260', tintOpacity: 0.24, night: 1, sun: 0 },
  { h: 24, top: '#151a40', bottom: '#2e3470', tint: '#1b2260', tintOpacity: 0.24, night: 1, sun: 0 },
]

/** Sky colors and lighting for a fractional hour (0 – 24). */
export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = (h - a.h) / (b.h - a.h)
  return {
    top: mixColor(a.top, b.top, t),
    bottom: mixColor(a.bottom, b.bottom, t),
    tint: mixColor(a.tint, b.tint, t),
    tintOpacity: lerp(a.tintOpacity, b.tintOpacity, t),
    night: lerp(a.night, b.night, t),
    sun: lerp(a.sun, b.sun, t),
  }
}

export const hourOf = (date: Date) => date.getHours() + date.getMinutes() / 60
