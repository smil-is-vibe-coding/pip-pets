import { CatBody } from './anim/body'
import {
  type AppearanceInput,
  type CatAppearance,
  type Personality,
  resolveAppearance,
  resolvePersonality,
} from './appearance'
import { ACTIONS, type ActionDef, type ActionId, type ActionInstance } from './behavior/actions'
import { Emitter } from './core/emitter'
import { type Vec, bump, chance, clamp, pick, rand, weightedPick } from './core/math'
import { Effects, type ParticleKind, type ThoughtIcon } from './effects'
import { emptyScene } from './scenes'
import {
  type Hint,
  type HintLevel,
  type LifeState,
  MOOD_STYLES,
  type Mood,
  type Needs,
  advanceLife,
  catchUpLife,
  createLife,
  deriveMood,
  hintLevel,
  topHint,
} from './sim/life'
import type { SceneDef } from './world/types'
import { type FoodKind, World } from './world/world'

export type { FoodKind }

export type SoundId =
  | 'meow'
  | 'mew'
  | 'chirp'
  | 'purr-start'
  | 'purr-stop'
  | 'hiss'
  | 'hmph'
  | 'munch'
  | 'yawn'
  | 'lap'
  | 'sniff'
  | 'scratch'
  | 'land'

export type SpeechKind = 'thought' | 'hint' | 'remind' | 'cheer' | 'routine' | 'thanks' | 'say'

export interface Speech {
  id: number
  text: string
  kind: SpeechKind
  /** Seconds of pet clock when it disappears. */
  until: number
  /** Optional metadata (e.g. where a thought came from) for rating buttons. */
  meta?: Record<string, string>
}

export type CareKind = 'feed' | 'treat' | 'water' | 'pet' | 'play' | 'boop'

export type CueKind = 'celebrate' | 'remind' | 'greet' | 'stretch-break' | 'drink' | 'look-outside' | 'goodnight'

export interface PetSnapshot {
  name: string
  needs: Readonly<Needs>
  mood: Mood
  action: ActionId
  asleep: boolean
  lightsOff: boolean
  toyMode: boolean
  focus: boolean
  hint: Hint | null
  bowlFood: number
  water: number
}

export interface PetEvents extends Record<string, unknown> {
  change: PetSnapshot
  sound: SoundId
  speech: Speech | null
  /** The human did something nice (for XP and stats). */
  care: CareKind
  /** A hint reached level 3 (for badges/notifications). */
  ask: Hint
  /** Fires once per tick; lets app logic piggyback on the (unthrottled) PiP render loop. */
  tick: number
}

export interface PetSave {
  version: 1
  name: string
  appearance: CatAppearance
  personality: Personality
  needs: Needs
  asleep: boolean
  savedAt: number
  world?: { food: number; foodKind: FoodKind; water: number }
}

export interface PetOptions {
  name?: string
  appearance?: AppearanceInput
  personality?: Partial<Personality>
  /** Restore a previous save; offline time is simulated on load. */
  save?: PetSave
  /** Multiplies how fast needs change (for testing). */
  simSpeed?: number
  scene?: SceneDef
}

const FOODS: Record<FoodKind, { units: number; value: number }> = {
  kibble: { units: 10, value: 6 },
  fish: { units: 8, value: 9 },
  treat: { units: 3, value: 5 },
}

const HINT_ICONS: Record<keyof Needs, ThoughtIcon> = {
  fullness: 'fish',
  hydration: 'water',
  energy: 'moon',
  affection: 'heart',
  fun: 'yarn',
}

const ASK_LINES: Record<keyof Needs, string[]> = {
  fullness: ["I'm sooo hungry… 🥺", 'Food? Please? 🐟', 'My tummy is rumbling!'],
  hydration: ['My water bowl is empty 💧', 'So thirsty…', 'Water, please? 💧'],
  energy: ['So… sleepy… 😪', 'Could we turn the lights down? 🌙', 'Need… nap…'],
  affection: ['Pet me? 🥺', 'I missed you…', 'Some love, please? 💕'],
  fun: ["I'm bored… play with me? 🧶", 'Toy time? Pleeease?', 'Entertain me, human!'],
}

const THANKS_LINES = ['Thank you! 💕', 'Purrfect, thanks! 😻', 'You’re the best! ✨', 'Mrrp! Thank you 💕']

/**
 * A living cat: owns the body (animation), life (needs/mood), its world (scene,
 * props, critters), the behavior brain, particles, and the interaction API.
 * Framework- and renderer-agnostic. Call `tick(Date.now())` every frame from any
 * view; repeated calls in the same frame are harmless.
 */
export class Pet {
  name: string
  appearance: CatAppearance
  personality: Personality
  readonly body: CatBody
  readonly life: LifeState
  readonly world: World
  readonly effects = new Effects()
  readonly events = new Emitter<PetEvents>()
  mood: Mood = 'content'
  simSpeed: number

  readonly props: {
    toy: Vec | null
    pointer: Vec | null
    /** When on, the cursor becomes a feather toy the cat chases. */
    toyMode: boolean
    lightsOff: boolean
  } = { toy: null, pointer: null, toyMode: false, lightsOff: false }

  /** The human is focusing: calm behaviors only. */
  focusMode = false
  /** Hold non-essential bubbles (meetings, focus). Level-3 asks wait until quiet ends. */
  quiet = false
  /** Spot the cat has settled at (renderers draw that spot's cover over the cat). */
  atSpot: string | null = null
  speech: Speech | null = null

  /** Pet-clock seconds (animation time). */
  clock = 0
  lastStrokeAt = -100
  private pointerAt = -100

  private current: { def: ActionDef; inst: ActionInstance; t: number } | null = null
  private next: { id: ActionId; arg?: unknown } | null = null
  private lastTick = 0
  private speakT = -1
  private changeTimer = 0
  private snapshotCache: PetSnapshot | null = null
  private moodCandidate: Mood = 'content'
  private moodCandidateFor = 0
  private speechId = 1

  // hint bookkeeping
  hint: Hint | null = null
  private levels: Partial<Record<keyof Needs, HintLevel>> = {}
  private nextHintThought = 20
  private lastAsk: Partial<Record<keyof Needs, number>> = {}
  private hintTimer = 0
  private lastStrokeCare = -100
  /** Why the cat is purring right now (petting, kneading…). */
  private purrSources = new Set<string>()

  constructor(opts: PetOptions = {}) {
    const save = opts.save
    this.name = save?.name ?? opts.name ?? 'Mochi'
    this.appearance = save?.appearance ? resolveAppearance(save.appearance) : resolveAppearance(opts.appearance)
    this.personality = save?.personality ?? resolvePersonality(opts.personality)
    this.simSpeed = opts.simSpeed ?? 1
    this.life = createLife(save?.needs)
    this.body = new CatBody(this.appearance)
    this.world = new World(opts.scene ?? emptyScene())
    this.body.onLand = (x, y) => {
      this.updateBounds()
      this.effects.spawn('puff', { x, y: y - 2 }, { size: 0.6 })
      this.sound('land')
    }
    this.body.setWorldScale(this.world.def.catScale ?? 1, this.appearance)
    this.body.x = this.world.width * 0.45
    this.updateBounds()
    if (save) {
      this.life.asleep = save.asleep
      if (save.world) {
        this.world.bowl.food = save.world.food
        this.world.bowl.kind = save.world.foodKind
        this.world.bowl.value = FOODS[save.world.foodKind].value
        this.world.water = save.world.water
      }
      catchUpLife(this.life, this.personality, (Date.now() - save.savedAt) / 1000)
    }
    this.mood = deriveMood(this.life, this.personality)
    this.body.style = MOOD_STYLES[this.mood]
    for (const n of Object.keys(this.life.needs) as (keyof Needs)[]) this.levels[n] = hintLevel(n, this.life.needs[n])
    this.start(this.life.asleep ? 'sleep' : 'idle')
  }

  // ---------------------------------------------------------------- loop

  tick(nowMs: number) {
    if (!this.lastTick) this.lastTick = nowMs
    const elapsed = Math.max(0, (nowMs - this.lastTick) / 1000)
    this.lastTick = nowMs
    if (elapsed < 0.001) return

    if (elapsed > 5) {
      // Page was hidden/closed for a while: simulate needs, skip animation.
      catchUpLife(this.life, this.personality, elapsed * this.simSpeed)
      if (this.life.asleep && this.current?.def.id !== 'sleep') this.start('sleep', undefined, true)
    } else {
      advanceLife(this.life, this.personality, elapsed * this.simSpeed)
    }

    const dt = Math.min(elapsed, 0.1)
    this.clock += dt
    this.updateMood(dt)
    this.updateHints(dt)
    this.updateBrain(dt)
    this.applySpeech(dt)
    if (this.purrSources.has('stroke') && this.clock - this.lastStrokeAt > 1.2) this.purr('stroke', false)
    this.world.update(dt)
    this.body.update(dt)
    this.effects.update(dt)
    if (this.speech && this.clock > this.speech.until) this.setSpeech(null)

    this.changeTimer -= dt
    if (this.changeTimer <= 0) this.emitChange()
    this.events.emit('tick', nowMs)
  }

  private updateMood(dt: number) {
    // Hysteresis: a new mood has to hold for a moment before it shows,
    // so the body language doesn't flicker around thresholds.
    const mood = deriveMood(this.life, this.personality)
    if (mood === this.mood) {
      this.moodCandidateFor = 0
      return
    }
    this.moodCandidateFor += mood === this.moodCandidate ? dt : -this.moodCandidateFor
    this.moodCandidate = mood
    if (this.moodCandidateFor > (mood === 'grumpy' ? 0.3 : 2.5)) {
      this.mood = mood
      this.moodCandidateFor = 0
      this.body.style = MOOD_STYLES[mood]
      this.emitChange()
    }
  }

  /** The hint ladder: body language → thought icons → asking out loud. */
  private updateHints(dt: number) {
    this.hintTimer -= dt
    if (this.hintTimer > 0) return
    this.hintTimer = 0.5
    const n = this.life.needs
    for (const need of Object.keys(n) as (keyof Needs)[]) {
      const level = hintLevel(need, n[need])
      const prev = this.levels[need] ?? 0
      this.levels[need] = level
      // A need that was clearly asked for got fixed: say thanks so the link is obvious.
      if (prev >= 2 && level === 0 && need !== 'energy') this.thank()
    }
    const hint = topHint(n)
    if (hint?.need !== this.hint?.need || hint?.level !== this.hint?.level) {
      this.hint = hint
      this.emitChange()
    }
    if (!hint || this.life.asleep) return
    if (hint.level >= 2) {
      this.nextHintThought -= 0.5
      if (this.nextHintThought <= 0 && !this.quiet && !this.speech) {
        this.think(HINT_ICONS[hint.need])
        this.nextHintThought = rand(90, 180)
      }
    }
    if (hint.level === 3 && !this.quiet && !this.speech) {
      const last = this.lastAsk[hint.need] ?? -1e9
      if (this.clock - last > 30 * 60) {
        this.lastAsk[hint.need] = this.clock
        this.say(pick(ASK_LINES[hint.need]), { kind: 'hint', duration: 7 })
        this.speak(chance(0.5) ? 'meow' : 'mew')
        this.events.emit('ask', hint)
      }
    }
  }

  private thank() {
    if (this.speech && this.speech.kind !== 'thought') return
    this.say(pick(THANKS_LINES), { kind: 'thanks', duration: 3.5 })
    for (let i = 0; i < 3; i++) this.emote('heart', { size: rand(0.7, 1.1), vx: rand(-14, 14) })
    this.sound('chirp')
  }

  /** Hint level (0–3) for a need. */
  hintLevel(need: keyof Needs): HintLevel {
    return this.levels[need] ?? 0
  }

  private updateBrain(dt: number) {
    if (this.current) {
      this.current.t += dt
      this.body.styleWeight = this.current.inst.styleWeight ?? 1
      if (this.current.inst.update(this.current.t, dt)) this.finish()
    }
    if (!this.current) {
      const queued = this.next
      this.next = null
      if (queued) this.start(queued.id, queued.arg, true)
      else this.start(this.choose(), undefined, true)
    }
  }

  private choose(): ActionId {
    const last = this.current?.def.id
    const options = Object.values(ACTIONS)
      .filter((a) => a.score && (!this.focusMode || a.calm))
      .map((a) => ({ item: a.id, weight: a.score!(this) * (a.id === last ? 0.4 : 1) }))
    return weightedPick(options) ?? 'idle'
  }

  private finish() {
    const cur = this.current
    this.current = null
    cur?.inst.exit?.()
  }

  /**
   * Start an action. Without `force` it only interrupts actions of
   * lower-or-equal priority. Returns whether it started.
   */
  start(id: ActionId, arg?: unknown, force = false): boolean {
    const def = ACTIONS[id]
    if (!force && this.current && def.priority < this.current.def.priority) return false
    if (this.current) {
      // Interrupting: drop whatever the old action wanted to chain into.
      const old = this.current
      this.current = null
      old.inst.exit?.()
      if (!force) this.next = null
    }
    this.current = { def, inst: def.start(this, arg), t: 0 }
    this.emitChange()
    return true
  }

  /** Run `id` after the current action finishes. */
  queue(id: ActionId, arg?: unknown) {
    this.next = { id, arg }
  }

  get action(): ActionId {
    return this.current?.def.id ?? 'idle'
  }

  // ---------------------------------------------------------------- expression

  emote(kind: ParticleKind, opts?: Parameters<Effects['spawn']>[2]) {
    const top = this.body.catToWorld(this.body.frame.headTop)
    this.effects.spawn(kind, { x: top.x + rand(-8, 8), y: top.y }, opts)
  }

  think(icon: ThoughtIcon) {
    const top = this.body.catToWorld(this.body.frame.headTop)
    this.effects.spawn('thought', { x: top.x + 34 * this.body.facing, y: top.y - 10 }, { icon, vx: 0 })
  }

  sound(id: SoundId) {
    this.events.emit('sound', id)
  }

  /** Opens the mouth for a vocalization and emits the sound. */
  speak(id: 'meow' | 'mew' | 'chirp' = 'meow') {
    this.speakT = 0
    this.sound(id)
  }

  /** Shows a speech bubble. Asleep cats only "say" routine/reminder lines. */
  say(text: string, opts: { kind?: SpeechKind; duration?: number; meta?: Record<string, string> } = {}) {
    const kind = opts.kind ?? 'say'
    if (this.quiet && (kind === 'thought' || kind === 'hint')) return false
    if (this.life.asleep && (kind === 'thought' || kind === 'hint')) return false
    const duration = opts.duration ?? Math.min(9, 3 + text.length * 0.06)
    this.setSpeech({ id: this.speechId++, text, kind, until: this.clock + duration, meta: opts.meta })
    if (!this.life.asleep && kind !== 'thought') this.speakT = 0
    return true
  }

  /** Keeps the bubble up a while longer (e.g. while hovered). */
  holdSpeech(seconds = 1) {
    if (this.speech) this.speech.until = Math.max(this.speech.until, this.clock + seconds)
  }

  dismissSpeech() {
    this.setSpeech(null)
  }

  private setSpeech(s: Speech | null) {
    this.speech = s
    this.events.emit('speech', s)
  }

  private applySpeech(dt: number) {
    if (this.speakT < 0) return
    this.speakT += dt
    const t = this.speakT / 0.55
    this.body.offsets.mouthOpen = (this.body.offsets.mouthOpen ?? 0) + bump(t) * 0.85
    this.body.offsets.headRot = (this.body.offsets.headRot ?? 0) - bump(t) * 5
    if (t >= 1) this.speakT = -1
  }

  get pointerRecent() {
    return this.clock - this.pointerAt < 2.5
  }

  // ---------------------------------------------------------------- productivity cues

  /** Ask the cat to perform a routine (used by the day director). */
  cue(kind: CueKind, text?: string) {
    if (this.life.asleep && kind !== 'remind' && kind !== 'goodnight') this.wakeQuietly()
    const map: Record<CueKind, ActionId> = {
      celebrate: 'celebrate',
      remind: 'remind',
      greet: 'greet',
      'stretch-break': 'stretchRoutine',
      drink: 'drinkBreak',
      'look-outside': 'lookOutside',
      goodnight: 'goodnight',
    }
    this.start(map[kind], text, true)
  }

  setFocus(on: boolean) {
    if (this.focusMode === on) return
    this.focusMode = on
    this.quiet = on || this.quiet
    if (on) this.start('focusNap', undefined, true)
    this.emitChange()
  }

  setQuiet(on: boolean) {
    this.quiet = on
  }

  private wakeQuietly() {
    if (this.action !== 'sleep' && this.action !== 'focusNap') return
    this.finish()
    this.next = null
  }

  // ---------------------------------------------------------------- interactions

  /** Pointer position in world space (or null when it leaves the stage). */
  setPointer(p: Vec | null) {
    if (p && this.props.pointer && Math.hypot(p.x - this.props.pointer.x, p.y - this.props.pointer.y) > 1) this.pointerAt = this.clock
    this.props.pointer = p
  }

  /** Starts/stops purring for a reason; the sound plays while any reason holds. */
  purr(source: string, on: boolean) {
    const was = this.purrSources.size > 0
    if (on) this.purrSources.add(source)
    else this.purrSources.delete(source)
    const now = this.purrSources.size > 0
    if (now !== was) this.sound(now ? 'purr-start' : 'purr-stop')
  }

  /** Called while the pointer strokes across the cat. `amount` ~ distance moved. */
  stroke(amount: number) {
    this.lastStrokeAt = this.clock
    // Purr whatever the cat is doing (asleep, eating, mid-routine): instant feedback.
    this.purr('stroke', true)
    if (this.clock - this.lastStrokeCare > 4) {
      this.lastStrokeCare = this.clock
      this.events.emit('care', 'pet')
    }
    const n = this.life.needs
    n.affection = clamp(n.affection + amount * 0.04 * (0.6 + this.personality.cuddly), 0, 100)
    const id = this.action
    if (id === 'petted' || id === 'annoyed') {
      if (id === 'annoyed') this.life.annoyance = Math.min(100, this.life.annoyance + amount * 0.05)
      return
    }
    if (id === 'sleep' || id === 'focusNap') {
      // Sleepy pets: purr and hearts, but stay asleep.
      if (chance(0.05)) this.emote('heart', { size: 0.7 })
      return
    }
    if (id === 'eat' || id === 'drink' || this.body.jumping || ACTIONS[id].priority >= 3) return
    if (this.life.annoyance > 60 || (this.mood === 'grumpy' && chance(0.5))) {
      this.start('annoyed')
      return
    }
    this.start('petted')
  }

  /** A click/tap on the cat. */
  boop() {
    const id = this.action
    this.events.emit('care', 'boop')
    if (id === 'sleep') {
      if (this.life.needs.energy < 40 && chance(0.5 + this.personality.grumpy * 0.5)) {
        this.finish()
        this.next = null
        this.start('startled', undefined, true)
        this.queue('annoyed')
      } else {
        this.wake()
        this.speak('mew')
      }
      return
    }
    this.life.annoyance = Math.min(100, this.life.annoyance + 6 + this.personality.grumpy * 14)
    if (this.life.annoyance > 55) {
      this.start('annoyed')
      return
    }
    this.body.blink()
    this.body.kick(chance(0.5) ? 'earL' : 'earR', 420)
    this.body.kick('bodySy', -1.2)
    this.emote(this.life.needs.affection > 50 ? 'heart' : 'exclaim', { size: 0.8 })
    this.speak(this.mood === 'grumpy' ? 'meow' : chance(0.6) ? 'mew' : 'chirp')
  }

  wake() {
    if (this.action !== 'sleep' && this.action !== 'focusNap') return
    this.finish()
    this.next = null
    this.start('stretch', undefined, true)
  }

  /** Fills the bowl; the cat comes running (most cats wake up for food). */
  feed(kind: FoodKind = 'kibble') {
    const f = FOODS[kind]
    this.world.fill(kind, f.units, f.value)
    this.events.emit('care', kind === 'treat' ? 'treat' : 'feed')
    if (kind === 'treat') {
      this.life.needs.affection = clamp(this.life.needs.affection + 6, 0, 100)
      this.life.needs.fun = clamp(this.life.needs.fun + 4, 0, 100)
    }
    if (this.action === 'sleep') {
      this.wake()
      this.queue('eat')
      return
    }
    if (this.life.needs.fullness < 85 || kind === 'treat') this.start('eat')
    this.emitChange()
  }

  refillWater() {
    this.world.water = 1
    this.events.emit('care', 'water')
    if (this.life.needs.hydration < 70 && this.action !== 'sleep') this.start('drink', undefined, false)
    this.emitChange()
  }

  /** Activates the cursor as a toy (world point) or turns it off with null. */
  setToy(p: Vec | null) {
    const was = this.props.toy
    this.props.toy = p
    if (p && !was && this.action !== 'sleep' && this.life.needs.energy > 15) {
      this.start('play')
      this.events.emit('care', 'play')
    }
  }

  setToyMode(on: boolean) {
    this.props.toyMode = on
    if (!on) this.setToy(null)
    this.emitChange()
  }

  setLights(on: boolean) {
    this.props.lightsOff = !on
    if (!on && this.action !== 'sleep' && this.life.needs.energy < 85) this.start('sleep')
    if (on && this.action === 'sleep' && this.life.needs.energy > 60) this.wake()
    this.emitChange()
  }

  /** Call the cat's name: it looks up and meows. */
  call() {
    if (this.action === 'sleep') {
      this.body.kick('earL', 300)
      return
    }
    this.start('meow')
  }

  // ---------------------------------------------------------------- customization & world

  setAppearance(input: AppearanceInput) {
    this.appearance = resolveAppearance(input, this.appearance)
    this.body.setAppearance(this.appearance)
    this.updateBounds()
  }

  setPersonality(input: Partial<Personality>) {
    this.personality = resolvePersonality({ ...this.personality, ...input })
  }

  setName(name: string) {
    this.name = name
    this.emitChange()
  }

  /** Move to another scene. The cat lands on the floor near the middle. */
  setScene(def: SceneDef) {
    const food = this.world.bowl.food
    const water = this.world.water
    this.world.setScene(def)
    this.world.bowl.food = food
    this.world.water = water
    this.atSpot = null
    this.body.elevation = 0
    this.body.surfaceId = 'floor'
    this.body.setWorldScale(def.catScale ?? 1, this.appearance)
    this.body.x = def.width * 0.45
    this.updateBounds()
    this.start('explore', undefined, true)
  }

  /** For scenes that size themselves to the viewport (the empty scene). */
  setStage(width: number) {
    if (this.world.def.id !== 'empty' || Math.abs(this.world.width - width) < 1) return
    this.world.def = emptyScene(width)
    this.world.surfaces[0].x1 = width
    this.updateBounds()
  }

  private updateBounds() {
    const b = this.body
    const s = this.world.surface(b.surfaceId)
    const margin = b.surfaceId === 'floor' ? 60 * b.size : 18
    b.bounds.min = Math.min(s.x0 + margin, (s.x0 + s.x1) / 2)
    b.bounds.max = Math.max(s.x1 - margin, (s.x0 + s.x1) / 2)
    if (!b.jumping) b.x = clamp(b.x, b.bounds.min, b.bounds.max)
  }

  // ---------------------------------------------------------------- tuning / debug

  setSimSpeed(multiplier: number) {
    this.simSpeed = multiplier
  }

  setNeed(key: keyof Needs, value: number) {
    this.life.needs[key] = clamp(value, 0, 100)
    this.emitChange()
  }

  setAnnoyance(value: number) {
    this.life.annoyance = clamp(value, 0, 100)
  }

  // ---------------------------------------------------------------- state out

  get snapshot(): PetSnapshot {
    return (this.snapshotCache ??= {
      name: this.name,
      needs: { ...this.life.needs },
      mood: this.mood,
      action: this.action,
      asleep: this.life.asleep,
      lightsOff: this.props.lightsOff,
      toyMode: this.props.toyMode,
      focus: this.focusMode,
      hint: this.hint,
      bowlFood: this.world.bowl.food,
      water: this.world.water,
    })
  }

  private emitChange() {
    this.changeTimer = 0.5
    this.snapshotCache = null
    this.events.emit('change', this.snapshot)
  }

  toJSON(): PetSave {
    return {
      version: 1,
      name: this.name,
      appearance: this.appearance,
      personality: this.personality,
      needs: { ...this.life.needs },
      asleep: this.life.asleep,
      savedAt: Date.now(),
      world: { food: this.world.bowl.food, foodKind: this.world.bowl.kind, water: this.world.water },
    }
  }
}
