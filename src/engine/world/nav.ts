import { clamp } from '../core/math'
import type { Surface } from './types'

export const MAX_JUMP_UP = 120
export const MAX_GAP = 80
const EDGE = 20

export interface NavStep {
  type: 'walk' | 'jump'
  x: number
  surface: string
  y: number
}

const overlap = (a: Surface, b: Surface) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)

/** Can the cat get from a to b in one jump? (Jumping down is always easier.) */
export function canJump(a: Surface, b: Surface) {
  const up = a.y - b.y
  if (up > MAX_JUMP_UP) return false
  return overlap(a, b) > -MAX_GAP
}

const inside = (s: Surface, x: number) => clamp(x, s.x0 + EDGE, s.x1 - EDGE)

/**
 * Plans walk/jump steps between surfaces with BFS (scenes have a handful of
 * surfaces, so this is trivially cheap).
 */
export function planRoute(surfaces: Surface[], from: { surface: string; x: number }, to: { surface: string; x: number }): NavStep[] {
  const byId = new Map(surfaces.map((s) => [s.id, s]))
  const start = byId.get(from.surface)
  const goal = byId.get(to.surface)
  if (!start || !goal) return []

  // BFS for the surface path.
  const prev = new Map<string, string | null>([[start.id, null]])
  const queue = [start.id]
  while (queue.length) {
    const id = queue.shift()!
    if (id === goal.id) break
    const a = byId.get(id)!
    for (const b of surfaces) {
      if (!prev.has(b.id) && canJump(a, b)) {
        prev.set(b.id, id)
        queue.push(b.id)
      }
    }
  }
  if (!prev.has(goal.id)) return []
  const path: Surface[] = []
  for (let id: string | null = goal.id; id; id = prev.get(id) ?? null) path.unshift(byId.get(id)!)

  const steps: NavStep[] = []
  let x = from.x
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const final = i === path.length - 1
    // Aim for where we eventually want to be, but stay on each surface.
    const aimX = final ? to.x : x
    let land = inside(b, aimX)
    let takeoff: number
    if (overlap(a, b) > EDGE * 2) {
      // Stacked surfaces: a short diagonal hop looks nicer than straight up.
      const dir = Math.sign(land - x) || 1
      takeoff = inside(a, land - dir * 34)
      land = inside(b, takeoff + dir * 34)
    } else {
      // Separate surfaces: leave from the nearest edge.
      const rightward = b.x0 >= a.x1 - EDGE
      takeoff = rightward ? a.x1 - EDGE : a.x0 + EDGE
      land = rightward ? b.x0 + EDGE : b.x1 - EDGE
    }
    steps.push({ type: 'walk', x: takeoff, surface: a.id, y: a.y })
    steps.push({ type: 'jump', x: land, surface: b.id, y: b.y })
    x = land
  }
  steps.push({ type: 'walk', x: inside(goal, to.x), surface: goal.id, y: goal.y })
  return steps
}
