import { type Task, pad, toMinutes, uid } from './store'

export interface ParsedTask {
  title: string
  start?: string
  durationMin?: number
  kind: 'task' | 'meeting'
}

const MEETING_WORDS = /\b(stand-?up|meeting|sync|1:1|1-1|one on one|call|interview|demo|retro|planning|review|huddle|catch ?up|lunch with|workshop|standup)\b/i

const to24 = (h: number, ampm?: string) => {
  const ap = ampm?.toLowerCase()
  if (ap === 'pm' && h < 12) return h + 12
  if (ap === 'am' && h === 12) return 0
  // No am/pm: early numbers are almost always afternoon in a workday.
  if (!ap && h >= 1 && h <= 6) return h + 12
  return h
}

const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`

/**
 * Light natural-language parsing for quick add:
 * "Standup 10:30 15m", "1:1 with Sam at 3pm", "Deck 45m", "Workshop 2-4pm".
 */
export function parseQuickAdd(input: string): ParsedTask | null {
  let text = ` ${input.trim()} `
  if (!text.trim()) return null
  let start: string | undefined
  let durationMin: number | undefined
  const cut = (m: RegExpMatchArray) => {
    text = text.replace(m[0], ' ')
  }

  // Ranges: 2-4pm, 10:00-11:30, 9am–10am
  const range = text.match(/\s(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\s(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\b/i)
  if (range) {
    let sh: number, sm: number, eh: number, em: number
    if (range[7]) {
      sh = Number(range[7])
      sm = Number(range[8])
      eh = Number(range[9])
      em = Number(range[10])
    } else {
      const endAp = range[6]
      eh = to24(Number(range[4]), endAp)
      em = Number(range[5] ?? 0)
      sh = to24(Number(range[1]), range[3] ?? endAp)
      sm = Number(range[2] ?? 0)
      if (sh > eh) sh -= 12
    }
    start = hhmm(sh, sm)
    durationMin = Math.max(5, eh * 60 + em - (sh * 60 + sm))
    cut(range)
  }

  if (!start) {
    const clock = text.match(/\s(?:at\s+|@\s*)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ?? text.match(/\s(?:at\s+|@\s*)?(\d{1,2})\s*(am|pm)\b/i) ?? text.match(/\s(?:at|@)\s*(\d{1,2})\b(?!\s*(?:m|min|h|hr))/i)
    if (clock) {
      const hasMinutes = clock[2] !== undefined && /^\d{2}$/.test(clock[2])
      const h = to24(Number(clock[1]), hasMinutes ? clock[3] : clock[2])
      const m = hasMinutes ? Number(clock[2]) : 0
      if (h < 24 && m < 60) {
        start = hhmm(h, m)
        cut(clock)
      }
    }
  }

  const hours = text.match(/\s(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)(?![a-z])(?:\s*(\d+)\s*(?:minutes|mins|min|m)(?![a-z]))?/i)
  if (hours) {
    durationMin = Math.round(Number(hours[1]) * 60 + Number(hours[2] ?? 0))
    cut(hours)
  } else {
    const mins = text.match(/\s(\d+)\s*(?:minutes|mins|min|m)(?![a-z])/i)
    if (mins) {
      durationMin = Number(mins[1])
      cut(mins)
    }
  }

  const title = text
    .replace(/\s(at|@|for|from)\s*$/i, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
  if (!title) return null
  const kind = start && (MEETING_WORDS.test(input) || durationMin !== undefined) ? 'meeting' : 'task'
  return { title: title[0].toUpperCase() + title.slice(1), start, durationMin, kind }
}

export function makeTask(p: ParsedTask, date: string): Task {
  return { id: uid(), ...p, date, done: false, createdAt: Date.now() }
}

/** Today's tasks: timed ones by start time, then the rest in creation order. */
export function tasksFor(tasks: Task[], date: string) {
  return tasks
    .filter((t) => t.date === date)
    .sort((a, b) => {
      if (a.start && b.start) return toMinutes(a.start) - toMinutes(b.start)
      if (a.start) return -1
      if (b.start) return 1
      return a.createdAt - b.createdAt
    })
}

const endOf = (t: Task) => toMinutes(t.start!) + (t.durationMin ?? 30)

/** The block happening right now, if any. */
export function currentBlock(tasks: Task[], date: string, nowMin: number) {
  return tasks.find((t) => t.date === date && t.start && !t.done && toMinutes(t.start) <= nowMin && nowMin < endOf(t))
}

/** What's next: the next upcoming block, otherwise the first open task. */
export function nextUp(tasks: Task[], date: string, nowMin: number): { task: Task; inMin?: number } | null {
  const today = tasksFor(tasks, date).filter((t) => !t.done)
  const upcoming = today.find((t) => t.start && toMinutes(t.start) >= nowMin)
  if (upcoming) {
    const inMin = Math.round(toMinutes(upcoming.start!) - nowMin)
    if (inMin <= 90) return { task: upcoming, inMin }
  }
  const open = today.find((t) => !t.start)
  if (open) return { task: open }
  return upcoming ? { task: upcoming, inMin: Math.round(toMinutes(upcoming.start!) - nowMin) } : null
}

/** Unfinished tasks from earlier days roll over to today (meetings don't). */
export function carryOver(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => t.date >= today || t.done || t.kind === 'task')
    .filter((t) => !(t.date < today && t.done && Date.now() - (t.doneAt ?? 0) > 14 * 864e5))
    .map((t) => (t.date < today && !t.done && t.kind === 'task' ? { ...t, date: today, carriedFrom: t.carriedFrom ?? t.date, start: undefined } : t))
}
