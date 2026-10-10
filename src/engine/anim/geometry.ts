import type { CatAppearance } from '../appearance'
import { type Vec, shade, smoothClosedPath, superellipse } from '../core/math'

/**
 * Static, appearance-derived geometry. Rebuilt only when the appearance
 * changes; per-frame work just transforms these parts.
 * All coordinates are in "cat units" at size 1, SVG y-down, facing right.
 */
export interface CatGeometry {
  appearance: CatAppearance
  colors: CatAppearance['colors'] & { furShade: string }

  bodyRx: number
  bodyRy: number
  /** Body outline, body-local (centered on 0,0). */
  bodyPath: string
  bellyPath: string
  hipFront: Vec
  hipBack: Vec
  /** Offset applied to far-side legs so they peek out behind near legs. */
  farOffset: Vec
  neck: Vec
  tailBase: Vec

  legLen: number
  legW: number

  headRx: number
  headRy: number
  /** Head outline, head-local. */
  headPath: string
  headOffset: Vec

  ear: {
    path: string
    innerPath: string
    base: Vec
    tilt: number
  }

  eye: {
    rx: number
    ry: number
    spacing: number
    y: number
    /** Resting cap on eye openness (sleepy eye shape). */
    restOpen: number
  }
  noseY: number
  mouthY: number
  headScale: number

  tail: {
    segments: number
    segLen: number
    width: number
    fluff: number
  }

  outline: number
}

function earPaths(w: number, h: number, shape: CatAppearance['ears']['shape']) {
  const hw = w / 2
  const outer =
    shape === 'round'
      ? `M${-hw} 2C${-hw} ${-h * 0.75} ${-hw * 0.45} ${-h} 0 ${-h}C${hw * 0.45} ${-h} ${hw} ${-h * 0.75} ${hw} 2Z`
      : `M${-hw} 2C${-hw * 0.75} ${-h * 0.5} ${-hw * 0.28} ${-h} 0 ${-h}C${hw * 0.28} ${-h} ${hw * 0.75} ${-h * 0.5} ${hw} 2Z`
  const iw = hw * 0.55
  const ih = h * 0.68
  const inner =
    shape === 'round'
      ? `M${-iw} 0C${-iw} ${-ih * 0.75} ${-iw * 0.45} ${-ih} 0 ${-ih}C${iw * 0.45} ${-ih} ${iw} ${-ih * 0.75} ${iw} 0Z`
      : `M${-iw} 0C${-iw * 0.7} ${-ih * 0.5} ${-iw * 0.25} ${-ih} 0 ${-ih}C${iw * 0.25} ${-ih} ${iw * 0.7} ${-ih * 0.5} ${iw} 0Z`
  return { outer, inner }
}

export function buildGeometry(a: CatAppearance): CatGeometry {
  const chub = a.body.chubby
  const bodyRx = 38 * a.body.length * (1 + chub * 0.06)
  const bodyRy = 24 * a.body.height * (1 + chub * 0.12)

  const bodyPts = superellipse(bodyRx, bodyRy, 2.3, 40, (p, t) => {
    const s = Math.sin(t)
    // Belly sag on the underside, slightly bigger rump than chest.
    const sag = s > 0 ? chub * bodyRy * 0.16 * s * s : 0
    const rump = p.x < 0 ? 1.06 : 1
    return { x: p.x, y: (p.y + sag) * rump }
  })

  const hs = a.head.size
  const headRx = 36 * hs
  const headRy = 30 * hs
  const n = 2.15 + a.head.squareness * 1.2
  let tuftIndex = 0
  const headPts = superellipse(headRx, headRy, n, 56, (p, t) => {
    const s = Math.sin(t)
    const c = Math.cos(t)
    let x = p.x
    let y = p.y
    if (s > 0) x *= 1 + a.head.cheeks * 0.13 * Math.sqrt(s)
    // Fluffy cheek tufts: alternate points pushed outward along the lower sides.
    if (s > 0.15 && s < 0.85 && Math.abs(c) > 0.45) {
      tuftIndex++
      if (tuftIndex % 2 === 0) {
        const push = a.head.tufts * 3.4 * hs
        x += Math.sign(c) * push
        y += push * 0.5
      }
    }
    return { x, y }
  })

  const earSize = a.ears.size * hs
  const folded = a.ears.shape === 'folded'
  const earW = 25 * earSize
  const earH = (folded ? 15 : 25) * earSize
  const ears = earPaths(earW, earH, a.ears.shape)

  const eyeScale = a.eyes.size * hs
  const almond = a.eyes.shape === 'almond'

  return {
    appearance: a,
    colors: { ...a.colors, furShade: a.colors.furShade ?? shade(a.colors.fur, -0.14) },
    bodyRx,
    bodyRy,
    bodyPath: smoothClosedPath(bodyPts),
    bellyPath: smoothClosedPath(superellipse(bodyRx * 0.62, bodyRy * 0.55, 2, 24, (p) => ({ x: p.x + bodyRx * 0.22, y: p.y + bodyRy * 0.62 }))),
    hipFront: { x: bodyRx * 0.5, y: bodyRy * 0.42 },
    hipBack: { x: -bodyRx * 0.52, y: bodyRy * 0.42 },
    farOffset: { x: 6, y: -3 },
    neck: { x: bodyRx * 0.6, y: -bodyRy * 0.45 },
    tailBase: { x: -bodyRx * 0.88, y: -bodyRy * 0.05 },
    legLen: 20 * a.legs.length,
    legW: 13 * a.legs.thickness * (1 + chub * 0.1),
    headRx,
    headRy,
    headPath: smoothClosedPath(headPts),
    headOffset: { x: 6, y: -headRy * 0.62 },
    ear: {
      path: ears.outer,
      innerPath: ears.inner,
      base: { x: headRx * a.ears.spread, y: -headRy * (folded ? 0.72 : 0.62) },
      tilt: folded ? 48 : 17,
    },
    eye: {
      rx: 6.8 * eyeScale * (almond ? 1.08 : 1),
      ry: 8.4 * eyeScale * (almond ? 0.78 : 1),
      spacing: 15.5 * a.eyes.spacing * hs,
      y: 3 * hs,
      restOpen: a.eyes.shape === 'sleepy' ? 0.72 : 1,
    },
    noseY: 11 * hs,
    mouthY: 13 * hs,
    headScale: hs,
    tail: {
      segments: 9,
      segLen: (64 * a.tail.length) / 9,
      width: 11 * a.tail.thickness,
      fluff: a.tail.fluff,
    },
    outline: a.outline,
  }
}
