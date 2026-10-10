/**
 * App state outside React: settings, tasks, progress, thoughts and the
 * session's timers. Persisted to localStorage (it's small and synchronous
 * reads keep startup simple). Everything stays on this device.
 */

export type Vibe = 'motivational' | 'silly' | 'calm' | 'facts' | 'sassy'
export type ThoughtFreq = 'rare' | 'sometimes' | 'chatty'
export type BreakStyle = 'pomodoro' | 'gentle' | 'water' | 'off'

export interface Settings {
  workStart: string
  workEnd: string
  lunch: string | null
  /** 0 = Sunday … 6 = Saturday */
  workdays: number[]
  breakStyle: BreakStyle
  focusMin: number
  breakMin: number
  longBreakMin: number
  longEvery: number
  /** Minutes between water reminders (0 = off). */
  hydrateEveryMin: number
  /** 20-20-20 eye breaks. */
  eyeBreaks: boolean
  meetingReminderMin: number
  vibes: Vibe[]
  thoughtFreq: ThoughtFreq
  onlineThoughts: boolean
  sound: boolean
  volume: number
  notifications: boolean
  sceneId: string
}

export interface Task {
  id: string
  title: string
  /** yyyy-mm-dd */
  date: string
  /** "HH:MM" — tasks with a time become blocks on the timeline. */
  start?: string
  durationMin?: number
  kind: 'task' | 'meeting'
  done: boolean
  doneAt?: number
  carriedFrom?: string
  createdAt: number
}

export interface DayStats {
  date: string
  tasksDone: number
  breaksTaken: number
  feeds: number
  pets: number
  plays: number
  xp: number
  highlights: string[]
}

export interface SavedThought {
  id: string
  text: string
  source: string
  savedAt: number
}

export type PromptKind = 'break' | 'focusDone' | 'hydrate' | 'eyes' | 'meeting' | 'lunch' | 'summary' | 'levelUp'

export interface Prompt {
  id: string
  kind: PromptKind
  title: string
  body?: string
  /** For meeting prompts. */
  taskId?: string
  createdAt: number
}

export interface FocusState {
  mode: 'idle' | 'focus' | 'break'
  endsAt: number
  startedAt: number
  /** Completed focus sessions today. */
  cycle: number
}

export interface AppState {
  version: 1
  onboarded: boolean
  onboardingStep: number
  settings: Settings
  tasks: Task[]
  progress: {
    xp: number
    daysTogether: number
    lastVisit: string
    diary: Record<string, DayStats>
  }
  thoughts: {
    saved: SavedThought[]
    /** Vibes/sources the user asked to see less of. */
    muted: string[]
    /** Recently shown thought ids (dedupe). */
    recent: string[]
    /** Prefetched online thoughts by vibe. */
    cache: Partial<Record<Vibe, { id: string; text: string; source: string }[]>>
    custom: string[]
  }
  session: {
    focus: FocusState
    dndUntil: number
    lastHydrate: number
    lastEyeBreak: number
    lastStretch: number
    /** Once-per-day events already fired, keyed like "lunch:2026-10-10". */
    fired: Record<string, true>
    prompt: Prompt | null
  }
}

export const DEFAULT_SETTINGS: Settings = {
  workStart: '09:00',
  workEnd: '18:00',
  lunch: '13:00',
  workdays: [1, 2, 3, 4, 5],
  breakStyle: 'pomodoro',
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  longEvery: 4,
  hydrateEveryMin: 60,
  eyeBreaks: false,
  meetingReminderMin: 5,
  vibes: ['motivational', 'silly'],
  thoughtFreq: 'sometimes',
  onlineThoughts: true,
  sound: false,
  volume: 0.5,
  notifications: false,
  sceneId: 'bedroom',
}

export const initialState = (): AppState => ({
  version: 1,
  onboarded: false,
  onboardingStep: 0,
  settings: { ...DEFAULT_SETTINGS },
  tasks: [],
  progress: { xp: 0, daysTogether: 0, lastVisit: '', diary: {} },
  thoughts: { saved: [], muted: [], recent: [], cache: {}, custom: [] },
  session: {
    focus: { mode: 'idle', endsAt: 0, startedAt: 0, cycle: 0 },
    dndUntil: 0,
    lastHydrate: Date.now(),
    lastEyeBreak: Date.now(),
    lastStretch: Date.now(),
    fired: {},
    prompt: null,
  },
})

const KEY = 'pip-pets:app:v1'

/** Fills in fields added after a save was written. */
function migrate(raw: unknown): AppState {
  const base = initialState()
  if (!raw || typeof raw !== 'object' || (raw as AppState).version !== 1) return base
  const s = raw as Partial<AppState>
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...s.settings },
    progress: { ...base.progress, ...s.progress },
    thoughts: { ...base.thoughts, ...s.thoughts },
    session: { ...base.session, ...s.session },
    tasks: s.tasks ?? [],
  } as AppState
}

type Listener = () => void

export class Store {
  private state: AppState
  private listeners = new Set<Listener>()
  private saveTimer = 0
  private blocked = false

  constructor() {
    let raw: unknown = null
    try {
      raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      raw = null
    }
    this.state = migrate(raw)
  }

  get = () => this.state

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  /** Immutable update: return a new state (spread what changes). */
  set(update: (s: AppState) => AppState) {
    this.state = update(this.state)
    this.listeners.forEach((l) => l())
    this.scheduleSave()
  }

  private scheduleSave() {
    if (this.blocked) return
    window.clearTimeout(this.saveTimer)
    this.saveTimer = window.setTimeout(() => this.flush(), 400)
  }

  flush() {
    if (this.blocked) return
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state))
    } catch {
      // Storage full/blocked: keep running in memory.
    }
  }

  export(): string {
    return JSON.stringify(this.state, null, 2)
  }

  import(json: string) {
    this.state = migrate(JSON.parse(json))
    this.listeners.forEach((l) => l())
    this.flush()
  }

  /** Wipes everything (call before reloading). */
  reset() {
    this.blocked = true
    try {
      localStorage.removeItem(KEY)
    } catch {
      // ignore
    }
  }
}

export const store = new Store()

// ---------------------------------------------------------------- small helpers

export const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Minutes since midnight for "HH:MM". */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const minutesNow = (d = new Date()) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60

export const formatTime = (hhmm: string) => {
  const mins = toMinutes(hhmm)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${pad(m)}${suffix}` : `${h12}${suffix}`
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export function emptyDay(date: string): DayStats {
  return { date, tasksDone: 0, breaksTaken: 0, feeds: 0, pets: 0, plays: 0, xp: 0, highlights: [] }
}

/** Update today's diary entry. */
export function bumpDay(s: AppState, change: (d: DayStats) => Partial<DayStats>): AppState {
  const key = dayKey()
  const day = s.progress.diary[key] ?? emptyDay(key)
  return { ...s, progress: { ...s.progress, diary: { ...s.progress.diary, [key]: { ...day, ...change(day) } } } }
}

// Shared singleton: reload the page instead of hot-swapping it.
import.meta.hot?.accept(() => location.reload())
