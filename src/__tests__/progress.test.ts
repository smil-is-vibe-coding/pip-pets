import { describe, expect, it } from 'vitest'
import { isUnlocked, levelFor, xpToReach } from '../app/progress'
import { initialState } from '../app/store'
import { contextualThoughts, pickThought } from '../app/thoughts/engine'

describe('bond levels', () => {
  it('starts at level 1 and levels up at thresholds', () => {
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(xpToReach(2)).level).toBe(2)
    expect(levelFor(xpToReach(3) - 1).level).toBe(2)
  })

  it('locks the garden until level 6', () => {
    expect(isUnlocked('scene:garden', xpToReach(5))).toBe(false)
    expect(isUnlocked('scene:garden', xpToReach(6))).toBe(true)
  })
})

describe('thoughts', () => {
  const ctx = { now: new Date(2026, 9, 12, 9, 30), petName: 'Mochi', tasksLeft: 3, doneToday: 0, firstOpen: 'Deck', next: null, focusCycles: 0, hint: null }

  it('builds lines from your day', () => {
    expect(contextualThoughts(ctx)).toContain('3 things on the list today. Let\'s start with “Deck”.')
  })

  it('never repeats a recently shown thought', () => {
    const state = initialState()
    state.settings.vibes = ['sassy']
    state.settings.onlineThoughts = false
    const seen = new Set<string>()
    for (let i = 0; i < 15; i++) {
      const t = pickThought(state, { ...ctx, tasksLeft: 0, firstOpen: undefined })!
      expect(seen.has(t.id)).toBe(false)
      seen.add(t.id)
      state.thoughts.recent.push(t.id)
    }
  })
})
