import type { SoundId } from '../engine'

/**
 * All cat sounds are synthesized with Web Audio: no audio files, no network.
 * Call `enable()` from a click (browsers require a user gesture for audio).
 */
export class CatAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private purr: { stop: () => void } | null = null
  enabled = false
  volume = 0.5

  enable() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      const len = this.ctx.sampleRate * 2
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    void this.ctx.resume()
    this.enabled = true
    this.setVolume(this.volume)
  }

  disable() {
    this.enabled = false
    this.stopPurr()
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  play(id: SoundId) {
    if (!this.enabled || !this.ctx) return
    // Sounds scheduled while the context resumes still play once it's running.
    if (this.ctx.state !== 'running') void this.ctx.resume()
    switch (id) {
      case 'meow':
        return this.voice([520, 780, 440], 0.6, 0.5, [700, 1150, 650])
      case 'mew':
        return this.voice([760, 960, 820], 0.28, 0.35, [1000, 1400, 1100])
      case 'chirp':
        return this.voice([620, 1150], 0.14, 0.35, [900, 1600])
      case 'yawn':
        return this.voice([330, 260, 170], 0.95, 0.25, [500, 900, 400])
      case 'purr-start':
        return this.startPurr()
      case 'purr-stop':
        return this.stopPurr()
      case 'hiss':
        return this.burst(0.55, 'highpass', 2600, 0.35)
      case 'hmph':
        return this.burst(0.16, 'lowpass', 900, 0.4)
      case 'munch':
        for (let i = 0; i < 3; i++) this.burst(0.05, 'bandpass', 1400 + Math.random() * 600, 0.3, i * 0.09)
        return
      case 'lap':
        return this.burst(0.03, 'highpass', 3000, 0.18)
      case 'sniff':
        this.burst(0.07, 'bandpass', 3200, 0.15)
        return this.burst(0.07, 'bandpass', 3200, 0.15, 0.12)
      case 'scratch':
        for (let i = 0; i < 6; i++) this.burst(0.06, 'bandpass', 2400, 0.12, i * 0.1)
        return
      case 'land':
        return this.thump()
    }
  }

  /** A vocal "meow": sawtooth through moving formant filters with vibrato. */
  private voice(pitch: number[], dur: number, level: number, formant: number[]) {
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const glide = (param: AudioParam, values: number[]) => {
      param.setValueAtTime(values[0], t0)
      values.slice(1).forEach((v, i) => param.linearRampToValueAtTime(v, t0 + (dur * (i + 1)) / (values.length - 1 || 1) * 0.95))
    }
    glide(osc.frequency, pitch)
    const vib = ctx.createOscillator()
    vib.frequency.value = 6
    const vibGain = ctx.createGain()
    vibGain.gain.value = pitch[0] * 0.015
    vib.connect(vibGain).connect(osc.frequency)

    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = 4
    glide(f1.frequency, formant)
    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'
    f2.Q.value = 6
    f2.frequency.value = 2400
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(level, t0 + 0.04)
    env.gain.setValueAtTime(level, t0 + dur * 0.7)
    env.gain.linearRampToValueAtTime(0, t0 + dur)
    osc.connect(f1).connect(env)
    osc.connect(f2).connect(env)
    // Narrow formant filters remove most of the energy; make it back up.
    const makeup = ctx.createGain()
    makeup.gain.value = 4
    env.connect(makeup).connect(this.master!)
    osc.start(t0)
    vib.start(t0)
    osc.stop(t0 + dur + 0.05)
    vib.stop(t0 + dur + 0.05)
  }

  private burst(dur: number, type: BiquadFilterType, freq: number, level: number, delay = 0) {
    const ctx = this.ctx!
    const t0 = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(level, t0 + Math.min(0.02, dur / 3))
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.connect(filter).connect(env).connect(this.master!)
    src.start(t0, Math.random())
    src.stop(t0 + dur + 0.02)
  }

  private thump() {
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(130, t0)
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.35, t0)
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14)
    osc.connect(env).connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + 0.16)
  }

  /**
   * Purr: a buzzy tone plus breathy noise, pulsed ~25 times a second and
   * swelling with each breath. Kept above ~150 Hz so laptop speakers can play it.
   */
  private startPurr() {
    if (this.purr) return
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const low = ctx.createBiquadFilter()
    low.type = 'bandpass'
    low.frequency.value = 420
    low.Q.value = 0.8
    const buzz = ctx.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 52
    const buzzFilter = ctx.createBiquadFilter()
    buzzFilter.type = 'lowpass'
    buzzFilter.frequency.value = 700
    const buzzGain = ctx.createGain()
    buzzGain.gain.value = 0.35
    const pulse = ctx.createGain()
    pulse.gain.value = 0.5
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 25
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.5
    lfo.connect(lfoGain).connect(pulse.gain)
    const breath = ctx.createGain()
    breath.gain.value = 0.6
    const breathLfo = ctx.createOscillator()
    breathLfo.frequency.value = 0.45
    const breathDepth = ctx.createGain()
    breathDepth.gain.value = 0.35
    breathLfo.connect(breathDepth).connect(breath.gain)
    const out = ctx.createGain()
    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(1.6, t0 + 0.5)
    src.connect(low).connect(pulse)
    buzz.connect(buzzFilter).connect(buzzGain).connect(pulse)
    pulse.connect(breath).connect(out).connect(this.master!)
    src.start()
    buzz.start()
    lfo.start()
    breathLfo.start()
    this.purr = {
      stop: () => {
        const t = ctx.currentTime
        out.gain.cancelScheduledValues(t)
        out.gain.setValueAtTime(out.gain.value, t)
        out.gain.linearRampToValueAtTime(0, t + 0.8)
        src.stop(t + 0.9)
        buzz.stop(t + 0.9)
        lfo.stop(t + 0.9)
        breathLfo.stop(t + 0.9)
      },
    }
  }

  private stopPurr() {
    this.purr?.stop()
    this.purr = null
  }

  /** Turns sound on/off from a click (that click unlocks audio in the browser). */
  toggle(on: boolean) {
    if (on) {
      this.enable()
      this.play('mew')
    } else this.disable()
  }
}

export const catAudio = new CatAudio()

// Shared singleton: reload the page instead of hot-swapping it.
import.meta.hot?.accept(() => location.reload())
