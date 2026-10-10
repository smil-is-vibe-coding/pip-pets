import type { NavStep } from '../world/nav'
import type { Pet } from '../pet'

/** Executes a planned route: walk along a surface, jump to the next, repeat. */
export class Trip {
  private i = 0
  private started = false
  private pet: Pet
  private steps: NavStep[]
  private speed: number
  readonly failed: boolean

  constructor(pet: Pet, steps: NavStep[], speed = 55) {
    this.pet = pet
    this.steps = steps
    this.speed = speed
    this.failed = steps.length === 0
    pet.atSpot = null
  }

  /** Returns true once the destination is reached (or the route is impossible). */
  update(): boolean {
    const b = this.pet.body
    while (this.i < this.steps.length) {
      const step = this.steps[this.i]
      if (!this.started) {
        this.started = true
        if (step.type === 'walk') {
          if (Math.abs(step.x - b.x) < 4) {
            this.next()
            continue
          }
          b.setPose('walk', {}, 70)
          b.walkTo(step.x, this.speed)
        } else {
          b.jumpTo(step.x, step.y, step.surface)
        }
        return false
      }
      if (b.moving) return false
      this.next()
    }
    return true
  }

  private next() {
    this.i++
    this.started = false
  }

  cancel() {
    if (!this.pet.body.jumping) this.pet.body.stop()
  }
}
