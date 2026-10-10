import { useSyncExternalStore } from 'react'

export type Route = 'home' | 'wardrobe' | 'diary' | 'settings'
const ROUTES: Route[] = ['home', 'wardrobe', 'diary', 'settings']

const read = (): Route => {
  const r = location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(r) ? r : 'home'
}

/** Minimal hash router so the app works from any static host. */
export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb)
      return () => window.removeEventListener('hashchange', cb)
    },
    read,
  )
}

export const go = (r: Route) => {
  location.hash = `/${r}`
}
