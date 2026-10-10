import { useEffect, useState, useSyncExternalStore } from 'react'
import { Pet, type PetOptions, type PetSnapshot } from '../engine'

/** Creates one Pet for the component's lifetime. */
export function usePet(options: () => PetOptions): Pet {
  const [pet] = useState(() => new Pet(options()))
  return pet
}

/** Re-renders with the pet's needs/mood/action (throttled by the engine to ~2/s plus on changes). */
export function usePetSnapshot(pet: Pet): PetSnapshot {
  return useSyncExternalStore(
    (onChange) => pet.events.on('change', onChange),
    () => pet.snapshot,
  )
}

/** Saves the pet periodically and when the page is hidden or closed. */
export function usePersistence(pet: Pet, save: (pet: Pet) => void, intervalMs = 5000) {
  useEffect(() => {
    const flush = () => save(pet)
    const id = window.setInterval(flush, intervalMs)
    const onHide = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      flush()
      window.clearInterval(id)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [pet, save, intervalMs])
}
