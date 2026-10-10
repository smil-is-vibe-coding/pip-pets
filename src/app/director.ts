import type { CareKind, CueKind, Pet } from '../engine'
import { pick } from '../engine/core/math'
import { catAudio } from './audio'
import { carryOver, currentBlock, makeTask, nextUp, parseQuickAdd, tasksFor } from './planner'
import { XP, awardXp, levelFor, unlocksAt } from './progress'
import { type AppState, type Prompt, type PromptKind, bumpDay, dayKey, minutesNow, store, toMinutes, uid } from './store'
import { markShown, pickThought, refillCache, thoughtDelay } from './thoughts/engine'

const MIN = 60_000
const BREAK_CUES: CueKind[] = ['stretch-break', 'drink', 'look-outside']

const greeting = (h: number) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')

/**
 * The "day director": watches the clock, your plan and your break rules, and
 * turns them into things the cat does. All product rules live here; the cat
 * engine stays a pure cat simulator.
 *
 * It piggybacks on the pet's tick (which runs in the PiP window's unthrottled
 * render loop), with a slow timer as a fallback when no view is mounted.
 */
export class Director {
  readonly pet: Pet
  /** Set by the UI while the PiP window is open (affects notifications). */
  pipOpen = false
  private lastRun = 0
  private nextThoughtAt = Date.now() + 90_000
  private nextRefill = 0
  private lastLevel: number
  private offs: (() => void)[] = []
  private timer = 0
  private greeted = false

  constructor(pet: Pet) {
    this.pet = pet
    this.lastLevel = levelFor(store.get().progress.xp).level
  }

  start() {
    this.offs.push(this.pet.events.on('tick', (now) => this.update(now)))
    this.offs.push(this.pet.events.on('care', (kind) => this.onCare(kind)))
    this.offs.push(this.pet.events.on('sound', (id) => catAudio.play(id)))
    this.offs.push(this.pet.events.on('ask', (hint) => this.notify(`${this.pet.name} needs you`, hint.need === 'fullness' ? 'Feeling hungry 🐟' : hint.need === 'hydration' ? 'The water bowl is empty 💧' : hint.need === 'affection' ? 'Could use some pets 💕' : hint.need === 'fun' ? 'Bored… play time? 🧶' : 'Very sleepy 🌙')))
    this.timer = window.setInterval(() => this.update(Date.now()), 5000)
    this.syncSound()
  }

  stop() {
    this.offs.forEach((off) => off())
    this.offs = []
    window.clearInterval(this.timer)
  }

  syncSound() {
    const { sound, volume } = store.get().settings
    catAudio.setVolume(volume)
    if (!sound) catAudio.disable()
  }

  // ---------------------------------------------------------------- the loop

  update(now: number) {
    if (now - this.lastRun < 1000) return
    this.lastRun = now
    const s = store.get()
    if (!s.onboarded) return
    const d = new Date(now)
    const today = dayKey(d)
    const nowMin = minutesNow(d)

    if (s.progress.lastVisit !== today) this.newDay(today)
    if (!this.greeted) this.greet(d)

    const st = store.get()
    const set = st.settings
    const workday = set.workdays.includes(d.getDay())
    const workTime = workday && nowMin >= toMinutes(set.workStart) && nowMin < toMinutes(set.workEnd)
    const block = currentBlock(st.tasks, today, nowMin)
    const inMeeting = block?.kind === 'meeting'
    const focus = st.session.focus
    const focusing = focus.mode === 'focus'
    const dnd = st.session.dndUntil > now
    const quiet = inMeeting || dnd || focusing
    this.pet.setQuiet(quiet)
    this.pet.setFocus(focusing)

    // --- focus timer
    if (focus.mode === 'focus' && now >= focus.endsAt) {
      const cycle = focus.cycle + 1
      const long = cycle % set.longEvery === 0
      const mins = long ? set.longBreakMin : set.breakMin
      store.set((x) => ({ ...x, session: { ...x.session, focus: { mode: 'break', startedAt: now, endsAt: now + mins * MIN, cycle }, lastStretch: now } }))
      awardXp(XP.focusSession)
      this.prompt('break', long ? 'Long break time! 🌿' : 'Break time! ☕', `${set.focusMin} minutes of focus done. Take ${mins} minutes with ${this.pet.name}.`)
      this.pet.setFocus(false)
      this.pet.cue(BREAK_CUES[(cycle - 1) % BREAK_CUES.length])
      this.notify('Break time! ☕', `Stretch, sip some water, rest your eyes.`)
      return
    }
    if (focus.mode === 'break' && now >= focus.endsAt) {
      store.set((x) => ({ ...x, session: { ...x.session, focus: { ...x.session.focus, mode: 'idle' } } }))
      this.prompt('focusDone', 'Break over', 'Ready for another focus session?')
      this.notify('Break over', 'Ready for another focus session?')
      return
    }

    // --- meetings / timed blocks
    for (const t of tasksFor(st.tasks, today)) {
      if (!t.start || t.done || st.session.fired[`m:${t.id}`]) continue
      const until = toMinutes(t.start) - nowMin
      if (until <= set.meetingReminderMin && until > -2) {
        this.fire(`m:${t.id}`)
        const when = until > 0.5 ? `in ${Math.round(until)} min` : 'starting now'
        this.pet.cue('remind', `🗓️ “${t.title}” ${when}!`)
        this.prompt('meeting', `${t.title} ${when}`, t.kind === 'meeting' ? 'Grab some water before you join 💧' : 'Time to get on it!', t.id)
        this.notify(`${t.title} ${when}`, `${this.pet.name} is reminding you 🐾`)
        return
      }
    }

    const busy = !!st.session.prompt || quiet
    // --- lunch
    if (workday && set.lunch && !st.session.fired[`lunch:${today}`]) {
      const l = toMinutes(set.lunch)
      if (nowMin >= l && nowMin < l + 60 && !inMeeting) {
        this.fire(`lunch:${today}`)
        this.pet.cue('remind', "Lunch time! 🍱 Go eat something good. (I'll have mine too.)")
        this.prompt('lunch', 'Lunch time 🍱', `Step away from the screen. Maybe feed ${this.pet.name} too?`)
        this.notify('Lunch time 🍱', 'Step away from the screen for a bit.')
        return
      }
    }

    // --- end of day
    if (workday && !st.session.fired[`eod:${today}`]) {
      const end = toMinutes(set.workEnd)
      if (nowMin >= end && nowMin < end + 180) {
        this.fire(`eod:${today}`)
        this.pet.cue('goodnight')
        this.prompt('summary', `That's a wrap! 🌙`, 'Here is your day with ' + this.pet.name)
        return
      }
    }

    // --- gentle breaks, water, eyes (only when nothing else is going on)
    if (workTime && !busy && set.breakStyle !== 'off') {
      if (set.breakStyle === 'gentle' && now - st.session.lastStretch >= 50 * MIN) {
        this.patchSession({ lastStretch: now })
        this.prompt('break', 'Time for a stretch 🙆', `You've been at it for a while. Stretch with ${this.pet.name}?`)
        this.pet.cue('stretch-break')
        this.notify('Time for a stretch 🙆', 'You have been working for 50 minutes.')
        return
      }
      if (set.hydrateEveryMin > 0 && now - st.session.lastHydrate >= set.hydrateEveryMin * MIN) {
        this.patchSession({ lastHydrate: now })
        this.prompt('hydrate', 'Water break 💧', `${this.pet.name} is having a drink. Join in?`)
        this.pet.cue('drink')
        this.notify('Water break 💧', 'Have a glass of water.')
        return
      }
      if (set.eyeBreaks && now - st.session.lastEyeBreak >= 20 * MIN) {
        this.patchSession({ lastEyeBreak: now })
        this.prompt('eyes', 'Eye break 👀', 'Look at something 20 feet away for 20 seconds.')
        this.pet.cue('look-outside')
        return
      }
    }

    // --- thoughts
    if (now >= this.nextRefill) {
      this.nextRefill = now + 30 * MIN
      void refillCache()
    }
    if (now >= this.nextThoughtAt) {
      if (quiet || this.pet.speech || this.pet.life.asleep || st.session.prompt) {
        this.nextThoughtAt = now + 2 * MIN
      } else {
        this.showThought(st, d, nowMin)
        this.nextThoughtAt = now + thoughtDelay(set.thoughtFreq)
      }
    }

    // --- level ups
    const level = levelFor(st.progress.xp).level
    if (level > this.lastLevel) {
      this.lastLevel = level
      const unlocked = unlocksAt(level)
      const what = unlocked.length ? `Unlocked: ${unlocked.map((u) => u.label).join(', ')}` : 'Your bond grows stronger 💕'
      this.prompt('levelUp', `Bond level ${level}! 🎉`, what)
      this.pet.cue('celebrate', `Level ${level}! 💕`)
    }
  }

  private newDay(today: string) {
    store.set((s) => ({
      ...s,
      tasks: carryOver(s.tasks, today),
      progress: { ...s.progress, lastVisit: today, daysTogether: s.progress.daysTogether + 1 },
      session: { ...s.session, fired: {}, focus: { mode: 'idle', endsAt: 0, startedAt: 0, cycle: 0 }, prompt: null },
    }))
    awardXp(XP.dailyVisit)
  }

  private greet(d: Date) {
    this.greeted = true
    const s = store.get()
    const open = tasksFor(s.tasks, dayKey(d)).filter((t) => !t.done)
    const line = open.length ? `${greeting(d.getHours())}! ${open.length} thing${open.length === 1 ? '' : 's'} on today's list.` : `${greeting(d.getHours())}! 👋`
    window.setTimeout(() => this.pet.cue('greet', line), 1500)
  }

  private showThought(s: AppState, d: Date, nowMin: number) {
    const today = dayKey(d)
    const list = tasksFor(s.tasks, today)
    const open = list.filter((t) => !t.done)
    const next = nextUp(s.tasks, today, nowMin)
    const t = pickThought(s, {
      now: d,
      petName: this.pet.name,
      tasksLeft: open.length,
      doneToday: list.length - open.length,
      firstOpen: open[0]?.title,
      next: next ? { title: next.task.title, inMin: next.inMin } : null,
      focusCycles: s.session.focus.cycle,
      hint: this.pet.hint,
    })
    if (!t) return
    if (this.pet.say(t.text, { kind: 'thought', meta: { id: t.id, source: t.source } })) markShown(t)
  }

  private onCare(kind: CareKind) {
    const award: Partial<Record<CareKind, number>> = { feed: XP.feed, treat: XP.treat, water: XP.water, pet: XP.pet, play: XP.play }
    const amount = award[kind]
    if (!amount) return
    awardXp(amount, (s) =>
      bumpDay(s, (day) => ({
        feeds: day.feeds + (kind === 'feed' || kind === 'treat' ? 1 : 0),
        pets: day.pets + (kind === 'pet' ? 1 : 0),
        plays: day.plays + (kind === 'play' ? 1 : 0),
      })),
    )
  }

  // ---------------------------------------------------------------- helpers

  private fire(key: string) {
    store.set((s) => ({ ...s, session: { ...s.session, fired: { ...s.session.fired, [key]: true } } }))
  }

  private patchSession(patch: Partial<AppState['session']>) {
    store.set((s) => ({ ...s, session: { ...s.session, ...patch } }))
  }

  private prompt(kind: PromptKind, title: string, body?: string, taskId?: string) {
    const p: Prompt = { id: uid(), kind, title, body, taskId, createdAt: Date.now() }
    this.patchSession({ prompt: p })
  }

  /** System notification, only when the cat can't be seen (no PiP, page hidden). */
  notify(title: string, body: string) {
    const s = store.get()
    if (!s.settings.notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (this.pipOpen || document.visibilityState === 'visible') return
    try {
      new Notification(title, { body, tag: 'pip-pets', silent: !s.settings.sound })
    } catch {
      // Some browsers only allow notifications from a service worker.
    }
  }

  // ---------------------------------------------------------------- user actions

  addTask(text: string) {
    const parsed = parseQuickAdd(text)
    if (!parsed) return null
    const task = makeTask(parsed, dayKey())
    store.set((s) => ({ ...s, tasks: [...s.tasks, task] }))
    return task
  }

  toggleTask(id: string) {
    const task = store.get().tasks.find((t) => t.id === id)
    if (!task) return
    const done = !task.done
    store.set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done, doneAt: done ? Date.now() : undefined } : t)) }))
    if (!done) return
    awardXp(XP.taskDone, (s) => bumpDay(s, (day) => ({ tasksDone: day.tasksDone + 1 })))
    const left = tasksFor(store.get().tasks, dayKey()).filter((t) => !t.done).length
    const line = left === 0 ? 'All done for today! You did it! 🎉' : pick(['Nice one! ✨', 'Done! You rock 💪', 'Woohoo! One less thing!', 'Checked off! 🐾'])
    this.pet.cue('celebrate', line)
  }

  updateTask(id: string, title: string) {
    store.set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, title } : t)) }))
  }

  deleteTask(id: string) {
    store.set((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }))
  }

  startFocus() {
    const now = Date.now()
    const set = store.get().settings
    store.set((s) => ({ ...s, session: { ...s.session, prompt: null, focus: { ...s.session.focus, mode: 'focus', startedAt: now, endsAt: now + set.focusMin * MIN } } }))
    this.pet.setFocus(true)
    this.pet.say(`Focus time! ${set.focusMin} minutes. I'll keep quiet 🤫`, { kind: 'cheer', duration: 4 })
  }

  stopFocus() {
    store.set((s) => ({ ...s, session: { ...s.session, focus: { ...s.session.focus, mode: 'idle' } } }))
    this.pet.setFocus(false)
  }

  setDnd(minutes: number) {
    this.patchSession({ dndUntil: minutes > 0 ? Date.now() + minutes * MIN : 0 })
  }

  /** Response to the current prompt card. */
  respond(action: 'done' | 'snooze' | 'skip' | 'start') {
    const p = store.get().session.prompt
    if (!p) return
    this.patchSession({ prompt: null })
    const now = Date.now()
    const set = store.get().settings
    if (action === 'done' && (p.kind === 'break' || p.kind === 'hydrate' || p.kind === 'eyes' || p.kind === 'lunch')) {
      awardXp(XP.breakTaken, (s) => bumpDay(s, (day) => ({ breaksTaken: day.breaksTaken + 1 })))
      if (p.kind === 'hydrate') this.pet.refillWater()
      this.pet.say(pick(['Yay, thank you for taking care of yourself 💕', 'Proud of you! ✨', 'Feels good, right? 😌']), { kind: 'cheer', duration: 4 })
    }
    if (action === 'snooze') {
      if (p.kind === 'hydrate') this.patchSession({ lastHydrate: now - (set.hydrateEveryMin - 10) * MIN })
      if (p.kind === 'eyes') this.patchSession({ lastEyeBreak: now - 10 * MIN })
      if (p.kind === 'break' && set.breakStyle === 'gentle') this.patchSession({ lastStretch: now - 40 * MIN })
      if (p.kind === 'meeting' && p.taskId) store.set((s) => ({ ...s, session: { ...s.session, fired: { ...s.session.fired, [`m:${p.taskId}`]: true } } }))
    }
    if (action === 'start') this.startFocus()
  }

  /** Ask for notification permission (must be called from a click). */
  async enableNotifications() {
    if (typeof Notification === 'undefined') return false
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    const ok = perm === 'granted'
    store.set((s) => ({ ...s, settings: { ...s.settings, notifications: ok } }))
    return ok
  }
}
