import { describe, expect, it } from 'vitest'
import { DEFAULT_PERSONALITY } from '../engine/appearance'
import { bedroom } from '../engine/scenes'
import { advanceLife, catchUpLife, createLife, hintLevel, topHint } from '../engine/sim/life'
import { canJump, planRoute } from '../engine/world/nav'
import { skyAt } from '../engine/world/time'

describe('navigation', () => {
  const surfaces = [{ id: 'floor', x0: 0, x1: bedroom.width, y: 0 }, ...bedroom.surfaces]

  it('reaches the high shelf by hopping onto the bed first', () => {
    const route = planRoute(surfaces, { surface: 'floor', x: 100 }, { surface: 'shelf', x: 518 })
    expect(route.filter((s) => s.type === 'jump').map((s) => s.surface)).toEqual(['bed', 'shelf'])
    expect(route.at(-1)).toMatchObject({ type: 'walk', surface: 'shelf' })
  })

  it("won't jump straight from the floor to the shelf", () => {
    const floor = surfaces[0]
    const shelf = surfaces.find((s) => s.id === 'shelf')!
    expect(canJump(floor, shelf)).toBe(false)
    expect(canJump(shelf, floor)).toBe(true)
  })

  it('returns an empty route for unknown surfaces', () => {
    expect(planRoute(surfaces, { surface: 'floor', x: 0 }, { surface: 'moon', x: 0 })).toEqual([])
  })
})

describe('needs and hints', () => {
  it('escalates hint levels as a need drops', () => {
    expect([60, 45, 30, 10].map((v) => hintLevel('fullness', v))).toEqual([0, 1, 2, 3])
  })

  it('picks the most urgent need', () => {
    const life = createLife({ fullness: 30, hydration: 15, fun: 40 })
    expect(topHint(life.needs)).toEqual({ need: 'hydration', level: 3 })
  })

  it('needs drop over time and sleeping restores energy', () => {
    const life = createLife()
    advanceLife(life, DEFAULT_PERSONALITY, 3600)
    expect(life.needs.fullness).toBeLessThan(80)
    const tired = createLife({ energy: 20 })
    tired.asleep = true
    advanceLife(tired, DEFAULT_PERSONALITY, 1800)
    expect(tired.needs.energy).toBeGreaterThan(20)
  })

  it('a weekend away never leaves the cat starving', () => {
    const life = createLife()
    catchUpLife(life, DEFAULT_PERSONALITY, 3 * 24 * 3600)
    expect(life.needs.fullness).toBeGreaterThanOrEqual(8)
    expect(life.needs.hydration).toBeGreaterThanOrEqual(10)
  })
})

describe('time of day', () => {
  it('is dark at midnight and bright at noon', () => {
    expect(skyAt(0).night).toBe(1)
    expect(skyAt(12).night).toBe(0)
    expect(skyAt(12).sun).toBe(1)
  })
})
