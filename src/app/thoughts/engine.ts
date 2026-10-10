import { pick } from '../../engine/core/math'
import type { Hint } from '../../engine'
import { type AppState, type ThoughtFreq, type Vibe, store } from '../store'
import { fetchThoughts, hasOnlineSource, hash } from './online'
import { PACKS } from './packs'

export interface Thought {
  id: string
  text: string
  /** Where it came from: a vibe, 'context', 'custom', or an online source name. */
  source: string
  vibe?: Vibe
}

export interface ThoughtContext {
  now: Date
  petName: string
  tasksLeft: number
  doneToday: number
  firstOpen?: string
  next: { title: string; inMin?: number } | null
  focusCycles: number
  hint: Hint | null
}

/** Lines built from the user's own day: the most useful kind of thought. */
export function contextualThoughts(c: ThoughtContext): string[] {
  const h = c.now.getHours()
  const out: string[] = []
  if (h < 11 && c.tasksLeft > 0 && c.firstOpen) out.push(`${c.tasksLeft} thing${c.tasksLeft === 1 ? '' : 's'} on the list today. Let's start with “${c.firstOpen}”.`)
  if (h >= 11 && c.tasksLeft > 1) out.push(`${c.tasksLeft} tasks left. You've got this! 💪`)
  if (c.tasksLeft === 1 && c.firstOpen) out.push(`Just “${c.firstOpen}” left. Almost there!`)
  if (c.doneToday >= 3) out.push(`${c.doneToday} tasks done today. Look at you go! ✨`)
  if (c.tasksLeft === 0 && c.doneToday > 0) out.push("Everything's done! Time for a well-earned stretch? 🙆")
  if (c.next?.inMin !== undefined && c.next.inMin > 10 && c.next.inMin <= 40) out.push(`“${c.next.title}” in ${c.next.inMin} min. Need a quick water break first? 💧`)
  if (h >= 13.5 && h < 15) out.push('Post-lunch slump? A glass of water and a stretch help 🍃')
  if (h >= 17 && h < 19) out.push('Almost done for the day. Finish strong!')
  if (c.focusCycles >= 2) out.push(`That's ${c.focusCycles} focus sessions today. Proud of you!`)
  if (c.now.getDay() === 5 && h >= 12) out.push('It’s Friday afternoon! The weekend can smell you coming 🎉')
  if (c.now.getDay() === 1 && h < 12) out.push('Monday again? We take it slow and steady. ☕')
  return out
}

const vibeWeight = (s: AppState, v: Vibe) => 1 / (1 + s.thoughts.muted.filter((m) => m.startsWith(`p-${v}-`) || m.startsWith(`${v}:`)).length * 0.25)

/** Chooses the next thought; returns null if there's nothing fresh. */
export function pickThought(s: AppState, ctx: ThoughtContext): Thought | null {
  const recent = new Set([...s.thoughts.recent, ...s.thoughts.muted])
  const roll = Math.random()

  const contextual = contextualThoughts(ctx).filter((t) => !recent.has(`c-${hash(t)}`))
  if (contextual.length && roll < 0.35) {
    const text = pick(contextual)
    return { id: `c-${hash(text)}`, text, source: 'context' }
  }
  if (s.thoughts.custom.length && roll < 0.5) {
    const text = pick(s.thoughts.custom)
    return { id: `u-${hash(text)}`, text, source: 'custom' }
  }

  const vibes = s.settings.vibes.length ? s.settings.vibes : (['motivational'] as Vibe[])
  const weighted = vibes.map((v) => ({ v, w: vibeWeight(s, v) }))
  let r = Math.random() * weighted.reduce((a, b) => a + b.w, 0)
  const vibe = weighted.find((x) => (r -= x.w) <= 0)?.v ?? vibes[0]

  const cached = s.settings.onlineThoughts ? (s.thoughts.cache[vibe] ?? []).filter((t) => !recent.has(t.id)) : []
  if (cached.length && Math.random() < 0.5) {
    const t = cached[0]
    return { id: t.id, text: t.text, source: t.source, vibe }
  }
  const lines = PACKS[vibe].filter((t) => !recent.has(`p-${vibe}-${hash(t)}`))
  if (!lines.length) return null
  const text = pick(lines)
  return { id: `p-${vibe}-${hash(text)}`, text, source: vibe, vibe }
}

/** Record a shown thought so it won't repeat soon; drop it from the online cache. */
export function markShown(t: Thought) {
  store.set((s) => ({
    ...s,
    thoughts: {
      ...s.thoughts,
      recent: [...s.thoughts.recent, t.id].slice(-150),
      cache: t.vibe ? { ...s.thoughts.cache, [t.vibe]: (s.thoughts.cache[t.vibe] ?? []).filter((c) => c.id !== t.id) } : s.thoughts.cache,
    },
  }))
}

let refilling = false

/** Keep a few online thoughts cached per selected vibe (best effort). */
export async function refillCache() {
  const s = store.get()
  if (refilling || !s.settings.onlineThoughts || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  refilling = true
  try {
    for (const vibe of s.settings.vibes) {
      if (!hasOnlineSource(vibe) || (store.get().thoughts.cache[vibe]?.length ?? 0) >= 4) continue
      const fresh = await fetchThoughts(vibe, 6)
      if (!fresh.length) continue
      store.set((st) => ({
        ...st,
        thoughts: { ...st.thoughts, cache: { ...st.thoughts.cache, [vibe]: [...(st.thoughts.cache[vibe] ?? []), ...fresh].slice(-12) } },
      }))
    }
  } finally {
    refilling = false
  }
}

/** Milliseconds until the next thought, with jitter. */
export function thoughtDelay(freq: ThoughtFreq) {
  const [lo, hi] = freq === 'rare' ? [45, 75] : freq === 'chatty' ? [6, 12] : [15, 25]
  return (lo + Math.random() * (hi - lo)) * 60_000
}

/** ⭐ keeps a thought in the diary; 👎 hides it and down-weights its kind. */
export function rateThought(id: string, text: string, source: string, action: 'save' | 'less') {
  store.set((s) => ({
    ...s,
    thoughts:
      action === 'save'
        ? { ...s.thoughts, saved: [{ id, text, source, savedAt: Date.now() }, ...s.thoughts.saved.filter((t) => t.id !== id)].slice(0, 100) }
        : { ...s.thoughts, muted: [...s.thoughts.muted, id, ...(source in PACKS ? [] : [`${source}:`])].slice(-300) },
  }))
}
