import type { SceneDef } from '../world/types'
import { bedroom } from './bedroom'
import { garden } from './garden'
import { office } from './office'

/** A bare floor (onboarding previews, the in-page fallback widget). */
export function emptyScene(width = 360): SceneDef {
  return {
    id: 'empty',
    label: 'Empty',
    width,
    surfaces: [],
    spots: [
      { id: 'bowl', kind: 'bowl', surface: 'floor', x: width * 0.22 },
      { id: 'water', kind: 'water', surface: 'floor', x: width * 0.3 },
      { id: 'front', kind: 'front', surface: 'floor', x: width * 0.55, pose: 'sit' },
      { id: 'rug', kind: 'rug', surface: 'floor', x: width * 0.7, pose: 'loaf' },
      { id: 'bed', kind: 'bed', surface: 'floor', x: width * 0.45, pose: 'sleep' },
    ],
    art: { wall: [], windows: [], back: [], front: [] },
  }
}

const SCENES: SceneDef[] = [bedroom, office, garden]

export const listScenes = () => SCENES
export const getScene = (id: string) => SCENES.find((s) => s.id === id) ?? bedroom
export { bedroom, office, garden }
