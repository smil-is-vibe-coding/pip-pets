import { describe, expect, it } from 'vitest'
import { carryOver, currentBlock, makeTask, nextUp, parseQuickAdd } from '../app/planner'

describe('parseQuickAdd', () => {
  it.each([
    ['Standup 10:30 15m', { title: 'Standup', start: '10:30', durationMin: 15, kind: 'meeting' }],
    ['1:1 with Sam at 3pm', { title: '1:1 with Sam', start: '15:00', kind: 'meeting' }],
    ['Finish deck 45m', { title: 'Finish deck', durationMin: 45, kind: 'task' }],
    ['Workshop 2-4pm', { title: 'Workshop', start: '14:00', durationMin: 120, kind: 'meeting' }],
    ['Design review 10:00-11:30', { title: 'Design review', start: '10:00', durationMin: 90, kind: 'meeting' }],
    ['Call mom at 6', { title: 'Call mom', start: '18:00', kind: 'meeting' }],
    ['Deep work 1h30m', { title: 'Deep work', durationMin: 90, kind: 'task' }],
    ['ship the release 9am', { title: 'Ship the release', start: '09:00', kind: 'task' }],
  ])('%s', (input, expected) => {
    expect(parseQuickAdd(input)).toMatchObject(expected)
  })

  it('rejects empty input', () => {
    expect(parseQuickAdd('   ')).toBeNull()
  })
})

describe('day planning', () => {
  const today = '2026-10-12'
  const standup = makeTask({ title: 'Standup', start: '10:30', durationMin: 15, kind: 'meeting' }, today)
  const deck = makeTask({ title: 'Deck', kind: 'task' }, today)

  it('finds the upcoming block, then open tasks', () => {
    expect(nextUp([standup, deck], today, 10 * 60)).toMatchObject({ task: { title: 'Standup' }, inMin: 30 })
    expect(nextUp([standup, deck], today, 11 * 60)?.task.title).toBe('Deck')
  })

  it('knows when a meeting is in progress', () => {
    expect(currentBlock([standup], today, 10 * 60 + 35)?.title).toBe('Standup')
    expect(currentBlock([standup], today, 10 * 60 + 50)).toBeUndefined()
  })

  it('carries unfinished tasks over but drops old meetings', () => {
    const old = [{ ...deck, date: '2026-10-09' }, { ...standup, date: '2026-10-09' }]
    const moved = carryOver(old, today)
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatchObject({ title: 'Deck', date: today, carriedFrom: '2026-10-09' })
  })
})
