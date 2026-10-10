import type { PoseName } from '../anim/pose'
import type { Shape } from '../custom/shapes'
import type { Needs } from '../sim/life'

/**
 * World space: x grows right, y is height relative to the floor (negative = up),
 * matching the cat's coordinates.
 */

/** A walkable horizontal platform (floor, bed top, window sill, shelf, fence). */
export interface Surface {
  id: string
  x0: number
  x1: number
  y: number
}

export type SpotKind =
  | 'bed'
  | 'bowl'
  | 'water'
  | 'window'
  | 'scratcher'
  | 'box'
  | 'toys'
  | 'sunpatch'
  | 'desk'
  | 'rug'
  | 'perch'
  | 'front'

/** A place with a purpose. Behaviors choose spots, not coordinates. */
export interface Spot {
  id: string
  kind: SpotKind
  surface: string
  x: number
  /** Pose the cat settles into here (behaviors may override). */
  pose?: PoseName
  /** Which way to face when settled (1 = right). Omit to face the room center. */
  facing?: 1 | -1
  /** Drawn over the cat while it's at this spot (box front, bush leaves). */
  cover?: Shape[]
  /** Only usable during daytime (sun patches). */
  daytimeOnly?: boolean
}

export interface WindowRect {
  x: number
  y: number
  w: number
  h: number
  /** Where birds may land, in world space. */
  perches?: { x: number; y: number }[]
}

/** Code-drawn scene art, in world space. */
export interface SceneArt {
  /** Wall/sky backdrop, behind windows. */
  wall: Shape[]
  /** Sky openings filled with a time-of-day gradient. */
  windows: WindowRect[]
  /** Furniture and frames behind the cat. */
  back: Shape[]
  /** Foreground drawn over the cat (use sparingly). */
  front: Shape[]
  /** Warm light source that glows at night. */
  lamp?: { x: number; y: number; r: number }
}

export interface SceneDef {
  id: string
  label: string
  width: number
  /** Floor is added automatically spanning the full width. */
  surfaces: Surface[]
  spots: Spot[]
  art: SceneArt
  ambient?: { birds?: boolean; butterflies?: number }
  /** Cat size relative to the room (rooms draw furniture at a smaller scale). */
  catScale?: number
  /** Recommended visible height for the "fit" camera. */
  viewHeight?: number
  floorColor?: string
}

export type NeedBoost = Partial<Record<keyof Needs, number>>
