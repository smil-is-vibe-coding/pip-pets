import type { Vibe } from '../store'

export interface OnlineThought {
  id: string
  text: string
  source: string
}

/**
 * Optional online sources. Every one was checked to send CORS headers that
 * allow direct browser use, needs no key, and receives no user data.
 * Failures are silent: the bundled packs always work.
 */
const SOURCES: Partial<Record<Vibe, { name: string; fetch: () => Promise<OnlineThought | null> }[]>> = {
  motivational: [
    {
      name: 'DummyJSON',
      async fetch() {
        const r = await getJson<{ id: number; quote: string; author: string }>('https://dummyjson.com/quotes/random')
        return r && { id: `dj-${r.id}`, text: `“${r.quote}” — ${r.author}`, source: 'DummyJSON quotes' }
      },
    },
  ],
  calm: [
    {
      name: 'Advice Slip',
      async fetch() {
        const r = await getJson<{ slip: { id: number; advice: string } }>(`https://api.adviceslip.com/advice?t=${Date.now()}`)
        return r && { id: `as-${r.slip.id}`, text: r.slip.advice, source: 'Advice Slip' }
      },
    },
  ],
  facts: [
    {
      name: 'catfact.ninja',
      async fetch() {
        const r = await getJson<{ fact: string }>('https://catfact.ninja/fact?max_length=120')
        return r && { id: `cf-${hash(r.fact)}`, text: r.fact, source: 'catfact.ninja' }
      },
    },
    {
      name: 'meowfacts',
      async fetch() {
        const r = await getJson<{ data: string[] }>('https://meowfacts.herokuapp.com/')
        return r?.data[0] ? { id: `mf-${hash(r.data[0])}`, text: r.data[0], source: 'meowfacts' } : null
      },
    },
  ],
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
    clearTimeout(timer)
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const BLOCKLIST = /\b(kill|death|die|dead|suicide|hate|sex|drug|war|blood|stupid|idiot)\b/i

/** Keeps bubbles short and office-friendly. */
export const acceptable = (t: OnlineThought) => t.text.length >= 8 && t.text.length <= 130 && !BLOCKLIST.test(t.text)

export const hasOnlineSource = (vibe: Vibe) => !!SOURCES[vibe]?.length

/** Fetches up to `count` fresh items for a vibe, one request at a time. */
export async function fetchThoughts(vibe: Vibe, count: number): Promise<OnlineThought[]> {
  const sources = SOURCES[vibe] ?? []
  const out: OnlineThought[] = []
  let failures = 0
  while (out.length < count && failures < 3 && sources.length) {
    const src = sources[(out.length + failures) % sources.length]
    const t = await src.fetch()
    if (t && acceptable(t) && !out.some((o) => o.id === t.id)) out.push(t)
    else failures++
    await new Promise((r) => setTimeout(r, 400))
  }
  return out
}
