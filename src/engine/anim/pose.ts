import { Spring, dampingFor } from '../core/math'

/**
 * A pose is a flat bag of numeric channels. Poses are blended with springs,
 * procedural layers add on top, and the rig turns the result into geometry.
 *
 * Conventions (cat facing right, SVG y-down, degrees):
 * - leg angle: 0 = straight down, + = swung forward
 * - leg fold: 0 = full length, 1 = tucked; plant: 1 = paw stretches to the ground
 * - bodyRot: + = front end up
 * - tailAngle: 0 = straight back, 90 = straight up, negative = drooping
 * - tailCurl: degrees added per tail segment (+ curls forward over the back)
 * - ears: + = rotated outward/back (annoyed), - = pricked forward
 */
export interface Pose {
  lift: number
  bodyX: number
  bodyRot: number
  bodySx: number
  bodySy: number

  headX: number
  headY: number
  headRot: number

  fnA: number
  fnF: number
  fnP: number
  ffA: number
  ffF: number
  ffP: number
  bnA: number
  bnF: number
  bnP: number
  bfA: number
  bfF: number
  bfP: number
  /** > 0.5 draws the near front leg in front of the body (grooming, kneading). */
  pawUp: number

  tailAngle: number
  tailCurl: number
  tailSway: number
  tailSpeed: number
  tailPuff: number
  /** > 0.5 draws the tail in front of the body (wrapped around paws). */
  tailFront: number

  earL: number
  earR: number
  earFlat: number

  eyeOpen: number
  eyeHappy: number
  pupil: number
  lookX: number
  lookY: number
  mouthOpen: number
  tongue: number
  blush: number
  whisker: number
}

export type PoseChannel = keyof Pose
export type PoseOffsets = Partial<Record<PoseChannel, number>>

export const DEFAULT_POSE: Pose = {
  lift: 9,
  bodyX: 0,
  bodyRot: 0,
  bodySx: 1,
  bodySy: 1,
  headX: 0,
  headY: 0,
  headRot: 0,
  fnA: 0,
  fnF: 0,
  fnP: 1,
  ffA: 0,
  ffF: 0,
  ffP: 1,
  bnA: 0,
  bnF: 0,
  bnP: 1,
  bfA: 0,
  bfF: 0,
  bfP: 1,
  pawUp: 0,
  tailAngle: 40,
  tailCurl: 9,
  tailSway: 7,
  tailSpeed: 0.35,
  tailPuff: 1,
  tailFront: 0,
  earL: 0,
  earR: 0,
  earFlat: 0,
  eyeOpen: 1,
  eyeHappy: 0,
  pupil: 1,
  lookX: 0,
  lookY: 0,
  mouthOpen: 0,
  tongue: 0,
  blush: 1,
  whisker: 0,
}

export const POSE_CHANNELS = Object.keys(DEFAULT_POSE) as PoseChannel[]

const tucked: PoseOffsets = {
  fnF: 1, fnP: 0, fnA: 70,
  ffF: 1, ffP: 0, ffA: 70,
  bnF: 1, bnP: 0, bnA: 75,
  bfF: 1, bfP: 0, bfA: 75,
}

const sitting: PoseOffsets = {
  lift: 0,
  bodyX: -8,
  bodyRot: 52,
  bodySx: 0.95,
  bodySy: 1.04,
  headX: -6,
  headY: 4,
  fnA: -4,
  ffA: -4,
  bnA: 82, bnF: 1, bnP: 0,
  bfA: 82, bfF: 1, bfP: 0,
  tailAngle: -80,
  tailCurl: -13,
  tailSway: 4,
  tailSpeed: 0.25,
  tailFront: 1,
}

/** Named pose library. Each entry overrides channels of DEFAULT_POSE. */
export const POSES = {
  stand: {},
  walk: { lift: 8, tailAngle: 55, tailCurl: 12, headRot: -2 },
  sit: sitting,
  loaf: {
    ...tucked,
    lift: -1,
    bodySx: 1.06,
    bodySy: 0.9,
    headX: -2,
    headY: 8,
    tailAngle: -80,
    tailCurl: -14,
    tailSway: 3,
    tailSpeed: 0.18,
    tailFront: 1,
  },
  sleep: {
    ...tucked,
    lift: -2,
    bodyRot: -3,
    bodySx: 1.1,
    bodySy: 0.8,
    headX: -4,
    headY: 19,
    headRot: 10,
    tailAngle: -80,
    tailCurl: -15,
    tailSway: 1.5,
    tailSpeed: 0.12,
    tailFront: 1,
    earL: 12,
    earR: 12,
    eyeOpen: 0,
    whisker: -8,
  },
  crouch: {
    lift: 1,
    bodyRot: -5,
    bodySy: 0.9,
    bodySx: 1.05,
    fnF: 0.35, ffF: 0.35, bnF: 0.45, bfF: 0.45,
    fnA: 18, ffA: 18, bnA: -12, bfA: -12,
    headX: 4,
    headY: 6,
    tailAngle: 2,
    tailCurl: 2,
    tailSway: 16,
    tailSpeed: 0.9,
    earL: -8,
    earR: -8,
    pupil: 1.35,
  },
  pounce: {
    lift: 14,
    bodyRot: 10,
    bodySx: 1.12,
    bodySy: 0.9,
    fnA: 55, ffA: 50, fnP: 0, ffP: 0,
    bnA: -45, bfA: -40, bnP: 0, bfP: 0,
    tailAngle: 10,
    tailCurl: -4,
    earL: -10,
    earR: -10,
    pupil: 1.4,
    mouthOpen: 0.3,
  },
  stretch: {
    lift: 4,
    bodyRot: -20,
    bodySx: 1.14,
    bodySy: 0.88,
    fnA: 55, ffA: 50,
    bnA: -8, bfA: -8,
    headX: 10,
    headY: 16,
    headRot: -6,
    tailAngle: 75,
    tailCurl: 4,
    tailSway: 3,
    eyeOpen: 0,
    eyeHappy: 0.6,
    earL: 14,
    earR: 14,
  },
  groom: {
    ...sitting,
    pawUp: 1,
    fnA: 158,
    fnF: 0.42,
    fnP: 0,
    headX: 0,
    headY: 6,
    headRot: 14,
    eyeOpen: 0,
    eyeHappy: 0.4,
  },
  beg: {
    ...sitting,
    headRot: -6,
    headY: 0,
    earL: -6,
    earR: -6,
    pupil: 1.3,
    tailAngle: 20,
    tailCurl: 14,
    tailSway: 9,
    tailSpeed: 0.5,
  },
  eat: {
    lift: 7,
    bodyRot: -4,
    headX: 12,
    headY: 26,
    headRot: 18,
    fnA: 6, ffA: 6,
    eyeOpen: 0,
    eyeHappy: 0.8,
    tailAngle: 45,
    tailCurl: 14,
    tailSway: 10,
    tailSpeed: 0.6,
  },
  scared: {
    lift: 16,
    bodyRot: 4,
    bodySy: 1.1,
    bodySx: 0.95,
    fnA: -10, ffA: -10, bnA: 10, bfA: 10,
    tailAngle: 78,
    tailCurl: -2,
    tailPuff: 1.7,
    tailSway: 2,
    earL: 28,
    earR: 28,
    earFlat: 0.8,
    pupil: 1.5,
    mouthOpen: 0.25,
  },
  scratch: {
    lift: 0,
    bodyX: -4,
    bodyRot: 58,
    bodySy: 1.04,
    bnA: 6, bfA: 6,
    fnA: 138, fnF: 0.1, fnP: 0,
    ffA: 128, ffF: 0.1, ffP: 0,
    pawUp: 1,
    headX: 4,
    headY: 2,
    headRot: -6,
    tailAngle: -20,
    tailCurl: 8,
    tailSway: 10,
    tailSpeed: 0.8,
    earL: -4,
    earR: -4,
  },
  knead: {
    ...tucked,
    lift: 0,
    pawUp: 1,
    fnA: 25, fnF: 0.4, fnP: 0,
    ffA: 25, ffF: 0.4, ffP: 0,
    bodyRot: 6,
    bodySy: 0.95,
    headY: 4,
    eyeOpen: 0,
    eyeHappy: 1,
    tailAngle: 50,
    tailCurl: 14,
    tailSway: 4,
  },
} satisfies Record<string, PoseOffsets>

export type PoseName = keyof typeof POSES

export const buildPose = (name: PoseName, overrides?: PoseOffsets): Pose => ({
  ...DEFAULT_POSE,
  ...POSES[name],
  ...overrides,
})

/** Per-channel speed multipliers so faces react faster than bodies. */
const CHANNEL_SPEED: PoseOffsets = {
  eyeOpen: 4,
  eyeHappy: 2.5,
  pupil: 2,
  lookX: 2.5,
  lookY: 2.5,
  mouthOpen: 3,
  tongue: 3,
  earL: 1.8,
  earR: 1.8,
  earFlat: 1.8,
  whisker: 2,
  pawUp: 6,
  tailFront: 6,
}

/** Drives every channel toward a target pose with springs. */
export class PoseAnimator {
  readonly current: Pose = { ...DEFAULT_POSE }
  target: Pose = { ...DEFAULT_POSE }
  /** Base stiffness; lower = slower, floatier transitions. */
  stiffness = 90
  dampingRatio = 0.72
  private springs = new Map<PoseChannel, Spring>()

  constructor(initial: Pose = DEFAULT_POSE) {
    for (const ch of POSE_CHANNELS) {
      this.springs.set(ch, new Spring(initial[ch]))
      this.current[ch] = initial[ch]
    }
    this.target = { ...initial }
  }

  setTarget(pose: Pose, stiffness?: number) {
    this.target = pose
    if (stiffness !== undefined) this.stiffness = stiffness
  }

  /** Adds velocity to a channel, e.g. an ear twitch or a tail flick. */
  kick(channel: PoseChannel, velocity: number) {
    this.springs.get(channel)!.velocity += velocity
  }

  /** Jumps a channel straight to a value without animating. */
  snap(channel: PoseChannel, value: number) {
    const s = this.springs.get(channel)!
    s.value = value
    s.velocity = 0
    this.current[channel] = value
  }

  update(dt: number) {
    for (const ch of POSE_CHANNELS) {
      const k = this.stiffness * (CHANNEL_SPEED[ch] ?? 1)
      this.current[ch] = this.springs.get(ch)!.step(this.target[ch], dt, k, dampingFor(k, this.dampingRatio))
    }
  }
}
