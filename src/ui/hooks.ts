import { useCallback, useEffect, useState } from 'react'
import { rateThought } from '../app/thoughts/engine'
import type { Speech } from '../engine'

/** Re-renders every `ms` so countdowns and "next up" stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

/** Handler for the ⭐ / 👎 buttons on thought bubbles. */
export const useRateThought = () =>
  useCallback((s: Speech, action: 'save' | 'less') => {
    if (s.meta?.id) rateThought(s.meta.id, s.text, s.meta.source ?? 'cat', action)
  }, [])
