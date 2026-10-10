import { DEG, type Vec, Spring, TAU, clamp, dampingFor, lerp, r2, smoothClosedPath, smoothOpenPath } from '../core/math'
import type { CatGeometry } from './geometry'
import type { Pose } from './pose'

/** Everything a renderer needs for one frame, in cat-local coordinates. */
export interface LegFrame {
  hip: Vec
  paw: Vec
}

export interface RigFrame {
  body: { x: number; y: number; rot: number; sx: number; sy: number }
  legs: { fn: LegFrame; ff: LegFrame; bn: LegFrame; bf: LegFrame }
  pawUp: boolean
  tail: {
    fill: string
    outline: string
    /** Partial tail (from a few segments in) drawn over the body when wrapped. */
    frontFill: string
    frontOutline: string
    tipFill: string
    front: boolean
  }
  head: { x: number; y: number; rot: number }
  ears: { lRot: number; rRot: number; sy: number; shiftX: number }
  face: {
    lookX: number
    lookY: number
    eyeOpen: number
    eyeHappy: number
    pupil: number
    mouthOpen: number
    tongue: number
    blush: number
    whisker: number
  }
  shadow: { x: number; rx: number; opacity: number }
  /** Top of the head, for spawning emote particles. */
  headTop: Vec
}

/** Physically lagging tail: each segment springs toward its target angle. */
export class TailChain {
  private springs: Spring[] = []
  private phase = 0
  angles: number[] = []

  constructor(segments: number) {
    for (let i = 0; i < segments; i++) {
      this.springs.push(new Spring(Math.PI + 40 * DEG))
      this.angles.push(Math.PI + 40 * DEG)
    }
  }

  /** Nudge the whole tail, e.g. a flick of annoyance. */
  flick(strength: number) {
    this.springs.forEach((s, i) => (s.velocity += strength * (0.4 + i / this.springs.length)))
  }

  update(pose: Pose, dt: number, drag: number) {
    const n = this.springs.length
    this.phase = (this.phase + pose.tailSpeed * TAU * dt) % (TAU * 1000)
    const base = Math.PI + pose.tailAngle * DEG
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      const sway = pose.tailSway * DEG * Math.sin(this.phase - i * 0.55) * (0.35 + 0.65 * u)
      const target = base + pose.tailCurl * DEG * i + sway + drag * u * DEG
      const k = 300 / (1 + i * 0.45)
      this.angles[i] = this.springs[i].step(target, dt, k, dampingFor(k, 0.55))
    }
  }
}

const tmp = (x: number, y: number): Vec => ({ x, y })

export function createRigFrame(): RigFrame {
  const leg = () => ({ hip: tmp(0, 0), paw: tmp(0, 0) })
  return {
    body: { x: 0, y: 0, rot: 0, sx: 1, sy: 1 },
    legs: { fn: leg(), ff: leg(), bn: leg(), bf: leg() },
    pawUp: false,
    tail: { fill: '', outline: '', frontFill: '', frontOutline: '', tipFill: '', front: false },
    head: { x: 0, y: 0, rot: 0 },
    ears: { lRot: 0, rRot: 0, sy: 1, shiftX: 0 },
    face: { lookX: 0, lookY: 0, eyeOpen: 1, eyeHappy: 0, pupil: 1, mouthOpen: 0, tongue: 0, blush: 1, whisker: 0 },
    shadow: { x: 0, rx: 40, opacity: 0.2 },
    headTop: tmp(0, -100),
  }
}

/** Builds the tail outline polygon from chain points, starting at segment `from`. */
function tailShapes(pts: Vec[], widths: number[], from: number) {
  const left: Vec[] = []
  const right: Vec[] = []
  const n = pts.length
  for (let i = from; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    let tx = b.x - a.x
    let ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    tx /= len
    ty /= len
    const w = widths[i] / 2
    left.push({ x: pts[i].x - ty * w, y: pts[i].y + tx * w })
    right.push({ x: pts[i].x + ty * w, y: pts[i].y - tx * w })
    if (i === n - 1) {
      const tip = { x: pts[i].x + tx * w * 0.9, y: pts[i].y + ty * w * 0.9 }
      left.push(tip)
    }
  }
  const ring = [...left, ...right.reverse()]
  return { fill: smoothClosedPath(ring), outline: smoothOpenPath(ring) }
}

/**
 * Solves the cat's pose into part transforms. Pure apart from writing into `out`.
 * `hop` lifts the whole cat (jumps/pounces).
 */
export function solveRig(g: CatGeometry, p: Pose, tail: TailChain, hop: number, out: RigFrame): RigFrame {
  // --- body: keep the lowest point of the rotated, squashed ellipse on the ground
  const rot = -p.bodyRot * DEG
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const rx = g.bodyRx * p.bodySx
  const ry = g.bodyRy * p.bodySy
  const extent = Math.sqrt((rx * s) ** 2 + (ry * c) ** 2)
  const cx = p.bodyX
  const cy = -(extent + p.lift + hop)
  out.body.x = cx
  out.body.y = cy
  out.body.rot = rot / DEG
  out.body.sx = p.bodySx
  out.body.sy = p.bodySy

  const toCat = (v: Vec, o: Vec = tmp(0, 0)): Vec => {
    const lx = v.x * p.bodySx
    const ly = v.y * p.bodySy
    o.x = cx + lx * c - ly * s
    o.y = cy + lx * s + ly * c
    return o
  }

  // --- legs: angle in world space; planted legs stretch to reach the ground
  const groundY = -g.legW / 2 - hop
  const solveLeg = (leg: LegFrame, hipLocal: Vec, far: boolean, angle: number, fold: number, plant: number) => {
    const h = far ? tmp(hipLocal.x + g.farOffset.x, hipLocal.y + g.farOffset.y) : hipLocal
    toCat(h, leg.hip)
    const a = angle * DEG
    const dirX = Math.sin(a)
    const dirY = Math.cos(a)
    const natural = g.legLen
    let reach = natural
    if (dirY > 0.15) reach = clamp((groundY - leg.hip.y) / dirY, natural * 0.3, natural * 3.4)
    const len = lerp(natural, reach, clamp(plant)) * (1 - clamp(fold) * 0.62)
    leg.paw.x = leg.hip.x + dirX * len
    leg.paw.y = leg.hip.y + dirY * len
  }
  solveLeg(out.legs.fn, g.hipFront, false, p.fnA, p.fnF, p.fnP)
  solveLeg(out.legs.ff, g.hipFront, true, p.ffA, p.ffF, p.ffP)
  solveLeg(out.legs.bn, g.hipBack, false, p.bnA, p.bnF, p.bnP)
  solveLeg(out.legs.bf, g.hipBack, true, p.bfA, p.bfF, p.bfP)
  out.pawUp = p.pawUp > 0.5

  // --- tail chain
  const { segments, segLen, width, fluff } = g.tail
  const pts: Vec[] = [toCat(g.tailBase)]
  const widths: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    widths.push(width * p.tailPuff * (1 + fluff * 0.55 * Math.sin(Math.PI * u)) * (1 - 0.28 * u))
  }
  for (let i = 0; i < segments; i++) {
    const prev = pts[i]
    const a = tail.angles[i]
    let x = prev.x + Math.cos(a) * segLen
    let y = prev.y + Math.sin(a) * segLen
    // The tail drapes along the floor instead of passing through it.
    const floor = -widths[i + 1] / 2 - hop
    if (y > floor) {
      const dx = Math.sign(x - prev.x) || Math.sign(Math.cos(a)) || 1
      y = floor
      x = prev.x + dx * Math.sqrt(Math.max(0, segLen ** 2 - (y - prev.y) ** 2))
    }
    pts.push({ x, y })
  }
  const full = tailShapes(pts, widths, 0)
  const front = tailShapes(pts, widths, 3)
  const tip = tailShapes(pts, widths, segments - 2)
  out.tail.fill = full.fill
  out.tail.outline = full.outline
  out.tail.frontFill = front.fill
  out.tail.frontOutline = front.outline
  out.tail.tipFill = tip.fill
  out.tail.front = p.tailFront > 0.5

  // --- head follows the neck; a little of the body rotation carries through
  const neck = toCat(g.neck)
  out.head.x = neck.x + g.headOffset.x + p.headX
  out.head.y = neck.y + g.headOffset.y + p.headY
  out.head.rot = p.headRot - p.bodyRot * 0.12

  const lookX = clamp(p.lookX, -1, 1)
  const lookY = clamp(p.lookY, -1, 1)
  out.ears.lRot = -(g.ear.tilt + p.earL)
  out.ears.rRot = g.ear.tilt + p.earR
  out.ears.sy = 1 - clamp(p.earFlat) * 0.38
  out.ears.shiftX = -lookX * 2.2 * g.headScale

  const f = out.face
  f.lookX = lookX
  f.lookY = lookY
  f.eyeOpen = clamp(p.eyeOpen * g.eye.restOpen)
  f.eyeHappy = clamp(p.eyeHappy)
  f.pupil = clamp(p.pupil * g.appearance.eyes.pupil, 0.25, 1)
  f.mouthOpen = clamp(p.mouthOpen)
  f.tongue = clamp(p.tongue)
  f.blush = clamp(p.blush * g.appearance.face.blush, 0, 1.5)
  f.whisker = p.whisker

  out.shadow.x = cx
  out.shadow.rx = r2(g.bodyRx * 1.12 * p.bodySx)
  out.shadow.opacity = 0.16 * (1 - clamp(hop / 50))

  out.headTop.x = out.head.x
  out.headTop.y = out.head.y - g.headRy - 8
  return out
}
