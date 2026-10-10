import { useSyncExternalStore } from 'react'
import { type AppState, store } from './store'

/** Subscribe to a slice of app state. Selectors should return stored references or primitives. */
export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()))
}
