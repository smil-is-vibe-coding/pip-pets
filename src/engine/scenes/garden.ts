import { ellipsePath, rectPath } from '../custom/shapes'
import type { Shape } from '../custom/shapes'
import type { SceneDef } from '../world/types'
import { INK, basket, ellipse, fillOnly, line, plant, poly, rect, solid } from './kit'

const W = 760

function fence(): Shape[] {
  const out: Shape[] = []
  for (let x = -600; x < W + 600; x += 30) out.push(poly([[x, 0], [x, -104], [x + 13, -116], [x + 26, -104], [x + 26, 0]], '#efd2a8', 2.5))
  out.push(rect(-600, -88, W + 1200, 9, '#e2bf8f', 2, 2.5))
  out.push(rect(-600, -36, W + 1200, 9, '#e2bf8f', 2, 2.5))
  return out
}

function flowers(x: number): Shape[] {
  const out: Shape[] = [line(`M${x - 8} -30L${x - 12} -60M${x + 6} -30L${x + 10} -66M${x} -30V-52`, '#4f9a55', 3)]
  const heads: [number, number, string][] = [[x - 12, -62, '#ff7eb6'], [x + 10, -68, '#ffd34e'], [x, -54, '#b58cff']]
  for (const [cx, cy, c] of heads) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      out.push(solid(ellipsePath(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 3.6, 3.6), c, 1.5))
    }
    out.push(fillOnly(ellipsePath(cx, cy, 2.5, 2.5), '#fff3b0'))
  }
  out.push(poly([[x - 18, -30], [x + 18, -30], [x + 13, 0], [x - 13, 0]], '#e07a5f', 2.5))
  return out
}

const bushFront: Shape[] = [
  ellipse(40, -18, 30, 22, '#6fbf73', 2.5),
  ellipse(82, -16, 28, 20, '#78c97c', 2.5),
  ellipse(60, -30, 26, 20, '#82d186', 2.5),
]

export const garden: SceneDef = {
  id: 'garden',
  label: 'Sunny garden',
  width: W,
  viewHeight: 300,
  catScale: 0.66,
  floorColor: '#8cc77a',
  surfaces: [
    { id: 'fence', x0: 0, x1: W, y: -116 },
    { id: 'branch', x0: 586, x1: 676, y: -186 },
  ],
  spots: [
    { id: 'bush', kind: 'box', surface: 'floor', x: 62, pose: 'loaf', facing: 1, cover: bushFront },
    { id: 'flowers', kind: 'rug', surface: 'floor', x: 170, pose: 'sit' },
    { id: 'sunpatch', kind: 'sunpatch', surface: 'floor', x: 262, pose: 'loaf', daytimeOnly: true },
    { id: 'toys', kind: 'toys', surface: 'floor', x: 340, pose: 'sit' },
    { id: 'front', kind: 'front', surface: 'floor', x: 400, pose: 'sit' },
    { id: 'bowl', kind: 'bowl', surface: 'floor', x: 468 },
    { id: 'water', kind: 'water', surface: 'floor', x: 510 },
    { id: 'fence-left', kind: 'perch', surface: 'fence', x: 210, pose: 'sit' },
    { id: 'fence-right', kind: 'window', surface: 'fence', x: 560, pose: 'sit' },
    { id: 'branch', kind: 'bed', surface: 'branch', x: 628, pose: 'sleep' },
  ],
  ambient: { birds: true, butterflies: 3 },
  art: {
    wall: [],
    // The whole backdrop is sky.
    windows: [{ x: -600, y: -900, w: W + 1200, h: 900, perches: [{ x: 140, y: -122 }, { x: 330, y: -122 }, { x: 700, y: -122 }] }],
    back: [
      fillOnly(ellipsePath(160, -40, 260, 90), '#b9e0a8'),
      fillOnly(ellipsePath(560, -30, 300, 110), '#a8d59a'),
      fillOnly(ellipsePath(120, -250, 34, 14), '#ffffff', 0.9),
      fillOnly(ellipsePath(150, -258, 26, 14), '#ffffff', 0.9),
      fillOnly(ellipsePath(470, -280, 40, 14), '#ffffff', 0.85),
      fillOnly(ellipsePath(500, -288, 26, 12), '#ffffff', 0.85),
      ...fence(),
      // Tree with a branch to nap on.
      rect(680, -260, 28, 260, '#a8714f', 6),
      line('M684 -190Q640 -186 590 -190', INK, 12),
      line('M684 -190Q640 -186 590 -190', '#a8714f', 7),
      ellipse(694, -290, 70, 50, '#6fbf73'),
      ellipse(640, -270, 44, 32, '#78c97c'),
      ellipse(740, -262, 40, 30, '#78c97c'),
      // Grass.
      fillOnly(rectPath(-600, 0, W + 1200, 400), '#8cc77a'),
      line(`M-600 0H${W + 600}`, '#5e9e55', 3),
      ...Array.from({ length: 40 }, (_, i): Shape => {
        const x = -200 + i * 30
        return line(`M${x} 2l3 -9M${x + 6} 2l-2 -7`, '#5e9e55', 2)
      }),
      { d: 'M220 2L320 2L332 18L206 18Z', fill: '#fff4b8', opacity: 0, tag: 'sun' },
      // Bush back.
      ellipse(50, -24, 34, 26, '#5aa860', 2.5),
      ellipse(88, -22, 30, 24, '#5aa860', 2.5),
      ...flowers(170),
      ...plant(610, 0, 0.9),
      ...basket(340, 0),
      // Bird bath decoration.
      rect(556, -36, 12, 36, '#d6d2cc', 3),
      solid('M540 -44Q562 -30 584 -44Z', '#e8e4de'),
      fillOnly('M546 -44Q562 -36 578 -44Z', '#9fd8ff'),
    ],
    front: [],
  },
}
