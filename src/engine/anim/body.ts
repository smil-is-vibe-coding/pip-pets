import type { CatAppearance } from '../appearance'
import { type Vec, TAU, chance, clamp, damp, lerp, noise1, rand, smoothstep } from '../core/math'
import { type CatGeometry, buildGeometry } from './geometry'
import { DEFAULT_POSE, POSE_CHANNELS, type Pose, type PoseName, type PoseOffsets, PoseAnimator, buildPose } from './pose'
import { type RigFrame, TailChain, createRigFrame, solveRig } from './rig'

export type LookMode = 'around' | 'forward' | 'target' | 'none'

/**
 * The cat's physical self: pose blending, procedural life layers
 * (breathing, blinking, gait, look-at, twitches) and locomotion.
 * Behaviors drive it through this API; renderers read `frame`.
 *
 * World space: x in world units, y relative to the ground (negative = up).
 */
export class CatBody {
  geometry: CatGeometry
  readonly animator: PoseAnimator
  readonly tail: TailChain
  readonly frame: RigFrame = createRigFrame()
  /** The fully composed pose of the last update (for debugging/inspection). */
  readonly final: Pose = { ...DEFAULT_POSE }

  // --- placement
  x = 160
  facing: 1 | -1 = 1
  /** Animated facing; passes through 0 for a cute squashy turn. */
  facingVisual = 1
  size = 1
  /** Scene-dependent multiplier on the appearance size. */
  worldScale = 1
  bounds = { min: 60, max: 260 }

  /** Height of the surface the cat stands on (negative = up). */
  elevation = 0
  surfaceId = 'floor'

  // --- locomotion
  vx = 0
  hop = 0
  /** Called when a jump lands (for dust puffs and sounds). */
  onLand?: (x: number, y: number) => void
  private jump: { x0: number; y0: number; x1: number; y1: number; surface: string; t: number; crouch: number; dur: number; height: number } | null = null
  private moveTarget: number | null = null
  private moveSpeed = 55
  private gait = 0

  // --- pose composition
  private basePose: Pose = buildPose('stand')
  /** Mood-driven adjustments layered on the base pose (set by the pet). */
  style: PoseOffsets = {}
  styleWeight = 1
  /** Per-frame additive offsets written by the running action; cleared every update. */
  offsets: PoseOffsets = {}

  // --- life layers
  breathRate = 0.42
  breathDepth = 1
  private breath = 0
  blinkEnabled = true
  private blinkT = 0
  private blinkDur = 0
  private blinkHold = 0
  private nextBlink = 2
  private queuedBlinks = 0
  twitchEnabled = true
  private nextTwitch = 3
  private nextFlick = 6

  // --- look
  lookMode: LookMode = 'around'
  lookTarget: Vec | null = null
  private look = { x: 0, y: 0 }
  private glance = { x: 0, y: 0 }
  private nextGlance = 0

  private time = 0

  constructor(appearance: CatAppearance) {
    this.geometry = buildGeometry(appearance)
    this.size = appearance.size
    this.animator = new PoseAnimator(this.basePose)
    this.tail = new TailChain(this.geometry.tail.segments)
  }

  setAppearance(appearance: CatAppearance) {
    this.geometry = buildGeometry(appearance)
    this.size = appearance.size * this.worldScale
  }

  setWorldScale(scale: number, appearance: CatAppearance) {
    this.worldScale = scale
    this.size = appearance.size * scale
  }

  // ------------------------------------------------------------ pose API

  /** Transition to a named pose. `stiffness` controls speed (default 90). */
  setPose(name: PoseName, overrides?: PoseOffsets, stiffness = 90) {
    this.basePose = buildPose(name, overrides)
    this.animator.stiffness = stiffness
  }

  /** The pose currently being animated toward (before mood and layers). */
  get base(): Readonly<Pose> {
    return this.basePose
  }

  /** Tweak channels of the current base pose without changing the pose. */
  adjustPose(overrides: PoseOffsets) {
    this.basePose = { ...this.basePose, ...overrides }
  }

  kick(channel: keyof Pose, velocity: number) {
    this.animator.kick(channel, velocity)
  }

  blink(slow = false) {
    if (this.blinkDur > 0) return
    this.blinkT = 0
    this.blinkDur = slow ? 0.9 : 0.16
    this.blinkHold = slow ? 0.5 : 0
  }

  // ------------------------------------------------------------ locomotion

  walkTo(x: number, speed = 55) {
    this.moveTarget = clamp(x, this.bounds.min, this.bounds.max)
    this.moveSpeed = speed
    if (Math.abs(this.moveTarget - this.x) > 3) this.faceTo(this.moveTarget > this.x ? 1 : -1)
  }

  stop() {
    this.moveTarget = null
  }

  get moving() {
    return this.moveTarget !== null || this.jump !== null
  }

  get jumping() {
    return this.jump !== null
  }

  /** Crouch, leap in an arc, and land on another surface. */
  jumpTo(x: number, y: number, surface: string) {
    this.moveTarget = null
    const dx = x - this.x
    const up = Math.max(0, this.elevation - y)
    this.faceToward(x)
    this.jump = {
      x0: this.x,
      y0: this.elevation,
      x1: x,
      y1: y,
      surface,
      t: 0,
      crouch: 0.2,
      dur: 0.34 + up / 420 + Math.abs(dx) / 700,
      height: 14 + up * 0.32,
    }
  }

  faceTo(dir: 1 | -1) {
    this.facing = dir
  }

  faceToward(x: number) {
    if (Math.abs(x - this.x) > 4) this.faceTo(x > this.x ? 1 : -1)
  }

  // ------------------------------------------------------------ coordinates

  catToWorld(v: Vec): Vec {
    return { x: this.x + v.x * this.size * this.facingVisual, y: v.y * this.size + this.elevation }
  }

  /** Approximate head center in world space. */
  headWorld(): Vec {
    return this.catToWorld(this.frame.head)
  }

  // ------------------------------------------------------------ update

  update(dt: number) {
    this.time += dt
    this.updateLocomotion(dt)

    // Target = base pose blended with mood style.
    const target = { ...this.basePose }
    for (const ch in this.style) {
      const k = ch as keyof Pose
      target[k] += (this.style[k] ?? 0) * this.styleWeight
    }
    this.animator.setTarget(target)
    this.animator.update(dt)

    const f = this.final
    Object.assign(f, this.animator.current)
    this.applyBreathing(f, dt)
    this.applyGait(f, dt)
    this.applyJump(f)
    this.applyBlink(f, dt)
    this.applyLook(f, dt)
    this.applyTwitches(dt)
    for (const ch of POSE_CHANNELS) {
      const o = this.offsets[ch]
      if (o) f[ch] += o
    }
    this.offsets = {}

    this.tail.update(f, dt, this.vx * this.facing * 0.35)
    solveRig(this.geometry, f, this.tail, this.hop, this.frame)
  }

  private updateLocomotion(dt: number) {
    const j = this.jump
    if (j) {
      j.t += dt
      const u = clamp((j.t - j.crouch) / j.dur)
      if (j.t > j.crouch) {
        const e = u * u * (3 - 2 * u)
        this.x = lerp(j.x0, j.x1, e)
        this.elevation = lerp(j.y0, j.y1, e) - Math.sin(Math.PI * u) * j.height
      }
      if (u >= 1) {
        this.x = j.x1
        this.elevation = j.y1
        this.surfaceId = j.surface
        this.jump = null
        this.kick('bodySy', -2.4)
        this.kick('bodySx', 1.6)
        this.onLand?.(this.x, this.elevation)
      }
      this.vx = 0
      this.facingVisual = damp(this.facingVisual, this.facing, 16, dt)
      return
    }
    let desired = 0
    if (this.moveTarget !== null) {
      const dx = this.moveTarget - this.x
      if (Math.abs(dx) < 2) {
        this.moveTarget = null
      } else {
        desired = Math.sign(dx) * this.moveSpeed * clamp(Math.abs(dx) / 18, 0.35, 1)
        this.faceTo(dx > 0 ? 1 : -1)
      }
    }
    this.vx = damp(this.vx, desired, 7, dt)
    if (Math.abs(this.vx) < 0.5 && desired === 0) this.vx = 0
    this.x = clamp(this.x + this.vx * dt, this.bounds.min - 10, this.bounds.max + 10)
    this.facingVisual = damp(this.facingVisual, this.facing, 16, dt)
  }

  private applyJump(f: Pose) {
    const j = this.jump
    if (!j) return
    if (j.t < j.crouch) {
      // Wind-up: sink down, rear legs coil.
      const k = j.t / j.crouch
      f.bodySy -= 0.12 * k
      f.bodySx += 0.06 * k
      f.lift -= 4 * k
      f.bnF += 0.35 * k
      f.bfF += 0.35 * k
      f.fnF += 0.2 * k
      f.ffF += 0.2 * k
      f.earL -= 6 * k
      f.earR -= 6 * k
      return
    }
    // Airborne: stretch out, front paws reach, rear legs trail.
    const u = clamp((j.t - j.crouch) / j.dur)
    const reach = Math.sin(Math.PI * Math.min(1, u * 1.2))
    f.bodySx += 0.1 * reach
    f.bodySy -= 0.06 * reach
    f.bodyRot += (j.y1 < j.y0 ? 14 : -10) * reach
    f.fnA += 45 * reach
    f.ffA += 40 * reach
    f.bnA -= 40 * reach
    f.bfA -= 35 * reach
    f.fnP -= reach
    f.ffP -= reach
    f.bnP -= reach
    f.bfP -= reach
    f.lift += 6 * reach
    f.tailAngle += 10 * reach
  }

  private applyBreathing(f: Pose, dt: number) {
    this.breath = (this.breath + this.breathRate * TAU * dt) % TAU
    const b = Math.sin(this.breath) * this.breathDepth
    f.bodySy += b * 0.022
    f.bodySx -= b * 0.008
    f.headY += b * 0.7
  }

  private applyGait(f: Pose, dt: number) {
    const speed = Math.abs(this.vx)
    const amount = clamp(speed / 35)
    if (amount <= 0.01) return
    const gallop = smoothstep((speed - 90) / 50)
    const stride = (gallop > 0.5 ? 58 : 30) * (this.geometry.legLen / 20)
    this.gait = (this.gait + (speed * dt) / stride) % 1
    const phase = this.gait * TAU
    // Diagonal walk vs. bounding gallop leg phase offsets.
    const offs = {
      fn: lerp(0, 0, gallop),
      ff: lerp(0.5, 0.08, gallop),
      bn: lerp(0.5, 0.5, gallop),
      bf: lerp(0, 0.58, gallop),
    }
    const swing = lerp(24, 42, gallop) * amount
    for (const leg of ['fn', 'ff', 'bn', 'bf'] as const) {
      const p = phase + offs[leg] * TAU
      const A = `${leg}A` as const
      const F = `${leg}F` as const
      f[A] += Math.sin(p) * swing
      f[F] += Math.max(0, Math.cos(p)) * 0.45 * amount
    }
    f.lift += (1 - Math.cos(phase * 2)) * lerp(1.1, 4, gallop) * amount
    f.bodyRot += Math.sin(phase * (gallop > 0.5 ? 1 : 2)) * lerp(1.4, 9, gallop) * amount
    f.headY += Math.cos(phase * 2) * 1.2 * amount
    f.earL += gallop * 18
    f.earR += gallop * 18
  }

  private applyBlink(f: Pose, dt: number) {
    if (this.blinkDur > 0) {
      this.blinkT += dt
      const total = this.blinkDur + this.blinkHold
      const t = this.blinkT
      const half = this.blinkDur / 2
      const closed = t < half ? t / half : t < half + this.blinkHold ? 1 : 1 - (t - half - this.blinkHold) / half
      f.eyeOpen *= 1 - clamp(closed)
      if (this.blinkHold > 0) f.eyeHappy = Math.max(f.eyeHappy, 0.6 * clamp(closed))
      if (t >= total) {
        this.blinkDur = 0
        if (this.queuedBlinks > 0) {
          this.queuedBlinks--
          this.nextBlink = 0.08
        }
      }
      return
    }
    if (!this.blinkEnabled || f.eyeOpen < 0.3) return
    this.nextBlink -= dt
    if (this.nextBlink <= 0) {
      this.blink()
      if (chance(0.22)) this.queuedBlinks = 1
      this.nextBlink = rand(2.2, 6.5)
    }
  }

  private applyLook(f: Pose, dt: number) {
    let tx = 0
    let ty = 0
    if (this.lookMode === 'target' && this.lookTarget) {
      const head = this.headWorld()
      tx = clamp(((this.lookTarget.x - head.x) * this.facing) / 90, -1, 1)
      ty = clamp((this.lookTarget.y - head.y) / 90, -1, 1)
    } else if (this.lookMode === 'around') {
      this.nextGlance -= dt
      if (this.nextGlance <= 0) {
        const toViewer = chance(0.35)
        this.glance.x = toViewer ? 0 : rand(-0.9, 1)
        this.glance.y = toViewer ? 0 : rand(-0.6, 0.35)
        this.nextGlance = rand(1.2, 4)
      }
      tx = this.glance.x + noise1(this.time * 0.6, 3) * 0.08
      ty = this.glance.y + noise1(this.time * 0.6, 9) * 0.06
    }
    // Eyes snap (saccade), so use a fast damp.
    const speed = this.lookMode === 'none' ? 4 : 14
    this.look.x = damp(this.look.x, this.lookMode === 'none' ? 0 : tx, speed, dt)
    this.look.y = damp(this.look.y, this.lookMode === 'none' ? 0 : ty, speed, dt)
    f.lookX += this.look.x
    f.lookY += this.look.y
    f.headRot += this.look.y * 7
    f.headX += this.look.x * 2
  }

  private applyTwitches(dt: number) {
    if (!this.twitchEnabled) return
    this.nextTwitch -= dt
    if (this.nextTwitch <= 0) {
      const ear = chance(0.5) ? 'earL' : 'earR'
      this.kick(ear, rand(180, 380) * (chance(0.8) ? 1 : -1))
      if (chance(0.25)) this.kick('whisker', rand(-120, 120))
      this.nextTwitch = rand(2.5, 8)
    }
    this.nextFlick -= dt
    if (this.nextFlick <= 0) {
      this.tail.flick(rand(-3, 3))
      this.nextFlick = rand(4, 11)
    }
  }
}
