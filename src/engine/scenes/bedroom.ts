import { ellipsePath, rectPath } from '../custom/shapes'
import type { SceneDef } from '../world/types'
import { INK, basket, books, ellipse, fillOnly, lampGlowShape, line, plant, poly, rect, room, solid, windowFrame } from './kit'

const W = 720

export const bedroom: SceneDef = {
  id: 'bedroom',
  label: 'Cozy bedroom',
  width: W,
  viewHeight: 300,
  catScale: 0.66,
  surfaces: [
    { id: 'sill', x0: 58, x1: 212, y: -96 },
    { id: 'bed', x0: 430, x1: 596, y: -54 },
    { id: 'shelf', x0: 470, x1: 566, y: -170 },
  ],
  spots: [
    { id: 'window', kind: 'window', surface: 'sill', x: 135, pose: 'sit' },
    { id: 'sunpatch', kind: 'sunpatch', surface: 'floor', x: 128, pose: 'loaf', daytimeOnly: true },
    { id: 'rug', kind: 'rug', surface: 'floor', x: 170, pose: 'loaf' },
    { id: 'bowl', kind: 'bowl', surface: 'floor', x: 262 },
    { id: 'water', kind: 'water', surface: 'floor', x: 304 },
    { id: 'toys', kind: 'toys', surface: 'floor', x: 356, pose: 'sit' },
    { id: 'front', kind: 'front', surface: 'floor', x: 380, pose: 'sit' },
    { id: 'bed', kind: 'bed', surface: 'bed', x: 505, pose: 'sleep' },
    { id: 'shelf', kind: 'perch', surface: 'shelf', x: 518, pose: 'loaf' },
    {
      id: 'box',
      kind: 'box',
      surface: 'floor',
      x: 684,
      pose: 'loaf',
      facing: -1,
      cover: [
        solid(rectPath(650, -30, 68, 30, 2), '#e3ae6c'),
        poly([[650, -30], [636, -48], [664, -44], [668, -30]], '#d39a58', 2.5),
        line('M664 -16H704', '#b9824a', 2),
      ],
    },
  ],
  ambient: { birds: true },
  art: {
    wall: room(W, '#f8e6d6', '#dcab80', { stripes: '#f0d5bf' }),
    windows: [{ x: 76, y: -198, w: 118, h: 92, perches: [{ x: 104, y: -110 }, { x: 166, y: -110 }] }],
    back: [
      lampGlowShape(395, -150, 120),
      // Sun patch on the floor under the window.
      { d: 'M70 2L180 2L226 22L104 22Z', fill: '#fff4b8', opacity: 0, tag: 'sun' },
      ...windowFrame(76, -198, 118, 92),
      rect(54, -98, 162, 9, '#fff3e6', 3),
      // Rug.
      ellipse(165, 6, 92, 10, '#a9d6c2'),
      fillOnly(ellipsePath(165, 6, 70, 6), '#c9e8d8'),
      // Picture frame with a fish.
      rect(262, -228, 76, 56, '#fffaf2', 4),
      solid('M282 -200Q296 -214 312 -200Q296 -186 282 -200ZM312 -200L324 -209L324 -191Z', '#7ec8ff', 2.5),
      // Wall lamp.
      line('M395 -188V-172', INK, 3),
      poly([[380, -172], [410, -172], [418, -148], [372, -148]], '#ffd38a', 2.5),
      // Shelf with a plant and books.
      rect(444, -170, 160, 9, '#c98f6a', 3),
      line('M462 -161L470 -146M586 -161L578 -146', INK, 3),
      ...plant(458, -170, 0.6),
      ...books(570, -170),
      // Bed.
      rect(604, -138, 46, 138, '#c98f6a', 14),
      rect(420, -32, 232, 32, '#c98f6a', 6),
      rect(428, -6, 10, 12, '#a8714f', 2),
      rect(636, -6, 10, 12, '#a8714f', 2),
      rect(424, -56, 182, 26, '#fffaf2', 8),
      solid('M424 -46Q470 -60 520 -48Q560 -40 600 -50L604 -26L424 -26Z', '#8fb8e8'),
      fillOnly(ellipsePath(470, -38, 3, 3), '#ffffff', 0.7),
      fillOnly(ellipsePath(510, -36, 3, 3), '#ffffff', 0.7),
      fillOnly(ellipsePath(550, -38, 3, 3), '#ffffff', 0.7),
      rect(560, -74, 46, 22, '#fff8ee', 10),
      ...basket(356, 0),
      // Box (back side, the front is a cover).
      rect(650, -36, 68, 36, '#c98f50', 2),
      poly([[718, -36], [732, -54], [704, -50], [700, -36]], '#d39a58', 2.5),
    ],
    front: [],
    lamp: { x: 395, y: -150, r: 120 },
  },
}
