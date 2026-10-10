import { type AppState, bumpDay, store } from './store'

export const XP = {
  dailyVisit: 15,
  taskDone: 10,
  breakTaken: 8,
  focusSession: 6,
  feed: 4,
  treat: 2,
  water: 3,
  pet: 2,
  play: 3,
}

/** Total XP needed to reach a level (level 1 = 0 XP). */
export const xpToReach = (level: number) => 30 * level * (level - 1)

export function levelFor(xp: number) {
  let level = 1
  while (xp >= xpToReach(level + 1)) level++
  const base = xpToReach(level)
  const next = xpToReach(level + 1)
  return { level, into: xp - base, needed: next - base, progress: (xp - base) / (next - base) }
}

export interface Unlock {
  level: number
  id: string
  label: string
  kind: 'scene' | 'accessory'
}

export const UNLOCKS: Unlock[] = [
  { level: 1, id: 'scene:bedroom', label: 'Cozy bedroom', kind: 'scene' },
  { level: 1, id: 'acc:collar', label: 'Collar & bell', kind: 'accessory' },
  { level: 2, id: 'acc:bow', label: 'Bow', kind: 'accessory' },
  { level: 3, id: 'scene:office', label: 'Home office', kind: 'scene' },
  { level: 4, id: 'acc:bandana', label: 'Bandana', kind: 'accessory' },
  { level: 5, id: 'acc:flower', label: 'Flower', kind: 'accessory' },
  { level: 6, id: 'scene:garden', label: 'Sunny garden', kind: 'scene' },
  { level: 7, id: 'acc:glasses', label: 'Round glasses', kind: 'accessory' },
]

export const unlockLevel = (id: string) => UNLOCKS.find((u) => u.id === id)?.level ?? 1
export const isUnlocked = (id: string, xp: number) => levelFor(xp).level >= unlockLevel(id)
export const unlocksAt = (level: number) => UNLOCKS.filter((u) => u.level === level)

export function awardXp(amount: number, change?: (s: AppState) => AppState) {
  store.set((s) => {
    const next = bumpDay({ ...s, progress: { ...s.progress, xp: s.progress.xp + amount } }, (d) => ({ xp: d.xp + amount }))
    return change ? change(next) : next
  })
}
