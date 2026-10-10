import type { Pet, PetSave } from './engine'

const KEY = 'pip-pets:cat:v1'
let blocked = false

export function loadSave(): PetSave | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return undefined
    const save = JSON.parse(raw) as PetSave
    return save.version === 1 ? save : undefined
  } catch {
    return undefined
  }
}

export function savePet(pet: Pet) {
  if (blocked) return
  try {
    localStorage.setItem(KEY, JSON.stringify(pet.toJSON()))
  } catch {
    // Storage full or blocked (private mode): the cat just won't persist.
  }
}

/** Deletes the save and stops further saves (call before reloading). */
export function clearSave() {
  blocked = true
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
