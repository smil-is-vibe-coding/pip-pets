import { ellipsePath } from '../custom/shapes'
import type { SceneDef } from '../world/types'
import { INK, basket, books, ellipse, fillOnly, lampGlowShape, line, plant, poly, rect, room, windowFrame } from './kit'

const W = 720

export const office: SceneDef = {
  id: 'office',
  label: 'Home office',
  width: W,
  viewHeight: 300,
  catScale: 0.66,
  surfaces: [
    { id: 'sill', x0: 58, x1: 232, y: -96 },
    { id: 'desk', x0: 336, x1: 556, y: -66 },
    { id: 'chair', x0: 578, x1: 634, y: -46 },
    { id: 'shelf', x0: 574, x1: 700, y: -168 },
  ],
  spots: [
    { id: 'window', kind: 'window', surface: 'sill', x: 145, pose: 'sit' },
    { id: 'sunpatch', kind: 'sunpatch', surface: 'floor', x: 150, pose: 'loaf', daytimeOnly: true },
    { id: 'bowl', kind: 'bowl', surface: 'floor', x: 112 },
    { id: 'water', kind: 'water', surface: 'floor', x: 156 },
    { id: 'bed', kind: 'bed', surface: 'floor', x: 252, pose: 'sleep' },
    { id: 'toys', kind: 'toys', surface: 'floor', x: 318, pose: 'sit' },
    { id: 'front', kind: 'front', surface: 'floor', x: 400, pose: 'sit' },
    { id: 'desk', kind: 'desk', surface: 'desk', x: 420, pose: 'sit', facing: 1 },
    { id: 'chair', kind: 'perch', surface: 'chair', x: 606, pose: 'loaf' },
    { id: 'shelf', kind: 'perch', surface: 'shelf', x: 640, pose: 'loaf' },
    { id: 'scratcher', kind: 'scratcher', surface: 'floor', x: 664, facing: 1 },
  ],
  ambient: { birds: true },
  art: {
    wall: room(W, '#e6eef4', '#c09272', { wainscot: '#d2dee7' }),
    windows: [{ x: 76, y: -198, w: 138, h: 92, perches: [{ x: 110, y: -110 }, { x: 180, y: -110 }] }],
    back: [
      lampGlowShape(372, -110, 110),
      { d: 'M80 2L210 2L262 22L118 22Z', fill: '#fff4b8', opacity: 0, tag: 'sun' },
      ...windowFrame(76, -198, 138, 92, '#9fc6e8'),
      rect(54, -98, 182, 9, '#fafcff', 3),
      ...plant(28, 0, 1.1, '#5f8fbf'),
      // Cat cushion.
      ellipse(252, -4, 40, 9, '#f2a7a0'),
      fillOnly(ellipsePath(252, -6, 28, 5), '#f8c7c1'),
      ...basket(318, 0),
      // Shelf.
      rect(560, -168, 150, 9, '#a9785a', 3),
      line('M578 -159L586 -144M692 -159L684 -144', INK, 3),
      ...books(660, -168),
      ...plant(590, -168, 0.5, '#e07a5f'),
      // Chair.
      rect(624, -112, 14, 70, '#4d5b70', 5),
      rect(574, -48, 64, 10, '#5d6d85', 5),
      line('M604 -38V-10M588 -4L620 -4', INK, 4),
      ellipse(588, -3, 4, 4, '#3b4555', 2),
      ellipse(620, -3, 4, 4, '#3b4555', 2),
      // Desk.
      rect(330, -68, 232, 10, '#a9785a', 3),
      rect(340, -58, 10, 58, '#8e6247', 2),
      rect(470, -58, 84, 50, '#b88a69', 3),
      line('M480 -40H544M480 -24H544', '#8e6247', 2),
      // Laptop with a glowing screen.
      poly([[486, -70], [556, -70], [550, -66], [492, -66]], '#9aa7b8', 2.5),
      rect(494, -112, 54, 42, '#3b4a5c', 4),
      { d: 'M499 -107h44v32h-44Z', fill: '#8fd0ff', opacity: 0.85, tag: 'screen' },
      // Mug with steam.
      rect(360, -86, 18, 18, '#ffffff', 3),
      line('M378 -80Q386 -78 378 -72', INK, 2.5),
      line('M364 -94Q360 -100 366 -106M372 -94Q368 -100 374 -106', '#c8b8b0', 2),
      // Desk lamp.
      line('M392 -68L380 -100L400 -124', INK, 4),
      poly([[392, -132], [414, -122], [404, -112], [388, -122]], '#ffd38a', 2.5),
      // Scratching post.
      rect(654, -8, 54, 8, '#c98f6a', 2),
      rect(672, -96, 18, 88, '#e3c79d', 2),
      line('M672 -84H690M672 -70H690M672 -56H690M672 -42H690M672 -28H690', '#c4a27a', 2),
      rect(660, -102, 42, 8, '#c98f6a', 3),
      ellipse(698, -86, 5, 5, '#ff9fd0', 2),
      line('M698 -94V-102', INK, 1.5),
    ],
    front: [],
    lamp: { x: 372, y: -110, r: 110 },
  },
}
