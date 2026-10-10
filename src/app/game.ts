import { Pet, getScene } from '../engine'
import { loadSave } from '../storage'
import { Director } from './director'
import { store } from './store'

/** The one cat and its day director, shared by every view (page, PiP, widget). */
export const pet = new Pet({ save: loadSave(), name: 'Mochi', scene: getScene(store.get().settings.sceneId) })
export const director = new Director(pet)

const PIP_FLAG = 'pip-pets:pip-open'
export const pipFlag = {
  get: () => {
    try {
      return localStorage.getItem(PIP_FLAG) === '1'
    } catch {
      return false
    }
  },
  set: (open: boolean) => {
    try {
      localStorage.setItem(PIP_FLAG, open ? '1' : '0')
    } catch {
      // ignore
    }
  },
}

// Shared singleton: reload the page instead of hot-swapping it.
import.meta.hot?.accept(() => location.reload())
