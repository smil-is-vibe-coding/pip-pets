import { type Vec, clamp, damp, r2 } from '../core/math'
import type { Pet, Speech } from '../pet'
import { createCatRenderer } from './cat'
import { createDom } from './dom'
import { createParticleRenderer } from './particles'
import { createSceneRenderer } from './scene'

export interface PetViewOptions {
  /** Frame cap while awake (default 60). */
  fps?: number
  /** Frame cap while asleep (default 24). */
  sleepFps?: number
  /**
   * 'fit' shows the whole room (page view); 'follow' keeps a close view that
   * pans after the cat (small PiP windows).
   */
  camera?: 'fit' | 'follow'
  /** Visible world height for 'follow' and for the empty scene (default 210). */
  worldHeight?: number
  /** Pointer petting/booping/toy input (default true). */
  interactive?: boolean
  /** Show speech bubbles (default true). */
  bubbles?: boolean
  /** Rating buttons on thought bubbles. */
  onSpeechAction?: (speech: Speech, action: 'save' | 'less') => void
}

export interface PetView {
  svg: SVGSVGElement
  destroy(): void
}

let uidCounter = 0
const FLOOR_MARGIN = 26

export function mountPetView(container: HTMLElement, pet: Pet, opts: PetViewOptions = {}): PetView {
  const doc = container.ownerDocument
  const win = doc.defaultView as Window & typeof globalThis
  const uid = `pp${++uidCounter}`
  const fps = opts.fps ?? 60
  const sleepFps = opts.sleepFps ?? 24
  const followH = opts.worldHeight ?? 210
  const dom = createDom(doc)
  const { el, set } = dom

  const svg = el('svg', { width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid slice' })
  svg.style.display = 'block'
  svg.style.touchAction = 'none'
  svg.style.userSelect = 'none'
  const layer = () => el('g', {}, svg)
  const layers = {
    wall: layer(),
    windows: layer(),
    back: layer(),
    props: layer(),
    cat: layer(),
    covers: layer(),
    front: layer(),
    critters: el('g', { 'pointer-events': 'none' }, svg),
    tint: el('rect', { 'pointer-events': 'none', opacity: 0 }, svg),
    glow: el('g', { 'pointer-events': 'none', style: 'mix-blend-mode: screen' }, svg),
    dark: el('rect', { fill: '#0e1236', opacity: 0, 'pointer-events': 'none' }, svg),
    toy: el('g', { 'pointer-events': 'none' }, svg),
    particles: el('g', { 'pointer-events': 'none' }, svg),
  }
  if (win.getComputedStyle(container).position === 'static') container.style.position = 'relative'
  container.appendChild(svg)

  const cats = createCatRenderer(dom, svg, layers.cat, uid, pet)
  const scene = createSceneRenderer(dom, svg, layers, uid, pet)
  const particles = createParticleRenderer(dom, layers.particles, pet)

  // ------------------------------------------------------------------ camera

  let vw = 320
  let vh = 210
  const cam = { x: 0, bottom: FLOOR_MARGIN, ready: false }
  const view = { x: 0, y: 0, w: 0, h: 0 }

  function updateCamera(dt: number) {
    const w = container.clientWidth || 320
    const h = container.clientHeight || 200
    const aspect = w / h
    const world = pet.world
    const b = pet.body
    if (world.def.id === 'empty') {
      vh = followH
      vw = vh * aspect
      pet.setStage(vw)
      cam.x = vw / 2
      cam.bottom = FLOOR_MARGIN
    } else if (opts.camera === 'follow') {
      vh = followH
      vw = vh * aspect
      const half = vw / 2
      const target = world.width <= vw ? world.width / 2 : clamp(b.x + b.vx * 0.4, half, world.width - half)
      const bottom = FLOOR_MARGIN + Math.min(0, b.elevation + 30) * 0.9
      cam.x = cam.ready ? damp(cam.x, target, 3, dt) : target
      cam.bottom = cam.ready ? damp(cam.bottom, bottom, 3, dt) : bottom
    } else {
      // Fit the room's width; never show less than ~210 units of height.
      vw = world.width + 20
      vh = vw / aspect
      if (vh < 210) {
        vh = 210
        vw = vh * aspect
      }
      cam.x = world.width / 2
      cam.bottom = FLOOR_MARGIN
    }
    cam.ready = true
    view.x = cam.x - vw / 2
    view.y = cam.bottom - vh
    view.w = vw
    view.h = vh
    set(svg, 'viewBox', `${r2(view.x)} ${r2(view.y)} ${r2(view.w)} ${r2(view.h)}`)
  }

  // ------------------------------------------------------------------ overlays

  let dark = 0
  function renderDark(dt: number) {
    dark = damp(dark, pet.props.lightsOff ? 0.45 : 0, 4, dt)
    set(layers.dark, 'x', view.x - 5)
    set(layers.dark, 'y', view.y - 5)
    set(layers.dark, 'width', view.w + 10)
    set(layers.dark, 'height', view.h + 10)
    set(layers.dark, 'opacity', dark)
  }

  let toyEl: SVGGElement | null = null
  let toyString: SVGPathElement | null = null
  let toyFeather: SVGGElement | null = null
  let toySwing = 0
  let lastToy: Vec | null = null
  function renderToy(dt: number) {
    const toy = pet.props.toy
    if (!toy) {
      toyEl?.remove()
      toyEl = null
      lastToy = null
      return
    }
    if (!toyEl) {
      toyEl = el('g', {}, layers.toy)
      toyString = el('path', { stroke: '#8b6b4a', 'stroke-width': 1.2, fill: 'none' }, toyEl)
      toyFeather = el('g', {}, toyEl)
      const colors = ['#ff7eb6', '#7ec8ff', '#ffd166']
      colors.forEach((col, i) => el('ellipse', { cx: (i - 1) * 4, cy: 12, rx: 3.4, ry: 11, fill: col, stroke: '#4a2f27', 'stroke-width': 1.2, transform: `rotate(${(i - 1) * 22})` }, toyFeather!))
      el('circle', { r: 3.5, fill: '#ffd34e', stroke: '#4a2f27', 'stroke-width': 1.3 }, toyFeather)
    }
    const vx = lastToy ? (toy.x - lastToy.x) / Math.max(dt, 0.001) : 0
    lastToy = { ...toy }
    toySwing = damp(toySwing, clamp(-vx * 0.15, -40, 40), 6, dt)
    const top = view.y - 10
    set(toyString!, 'd', `M${r2(toy.x + 30)} ${r2(top)}Q${r2(toy.x + 10)} ${r2((toy.y + top) / 2)} ${r2(toy.x)} ${r2(toy.y)}`)
    set(toyFeather!, 'transform', `translate(${r2(toy.x)} ${r2(toy.y)}) rotate(${r2(toySwing)})`)
  }

  // Speech bubble: HTML over the SVG so text wraps nicely.
  const outline = () => pet.body.geometry.colors.outline
  const bubble = doc.createElement('div')
  bubble.setAttribute('role', 'status')
  Object.assign(bubble.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    maxWidth: 'min(250px, 82%)',
    padding: '7px 11px',
    borderRadius: '14px',
    background: '#ffffff',
    color: '#3a2a2a',
    font: '700 13px/1.35 Nunito, system-ui, sans-serif',
    boxShadow: '0 4px 14px rgba(60, 30, 20, 0.18)',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease',
    zIndex: '2',
    textAlign: 'left',
  } satisfies Partial<CSSStyleDeclaration>)
  const bubbleText = doc.createElement('span')
  const bubbleActions = doc.createElement('span')
  Object.assign(bubbleActions.style, { marginLeft: '6px', whiteSpace: 'nowrap' })
  const bubbleTail = doc.createElement('div')
  Object.assign(bubbleTail.style, { position: 'absolute', bottom: '-7px', width: '12px', height: '12px', background: '#ffffff', transform: 'rotate(45deg)' })
  bubble.append(bubbleText, bubbleActions, bubbleTail)
  if (opts.bubbles !== false) container.appendChild(bubble)

  const makeButton = (label: string, title: string, action: 'save' | 'less') => {
    const btn = doc.createElement('button')
    btn.textContent = label
    btn.title = title
    Object.assign(btn.style, { border: 'none', background: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '12px', opacity: '0.7' })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (pet.speech) opts.onSpeechAction?.(pet.speech, action)
      btn.style.opacity = '1'
      btn.disabled = true
    })
    return btn
  }

  const showSpeech = (s: Speech | null) => {
    if (!s) {
      bubble.style.opacity = '0'
      bubble.style.pointerEvents = 'none'
      return
    }
    bubbleText.textContent = s.text
    bubbleActions.replaceChildren()
    if (s.kind === 'thought' && opts.onSpeechAction) bubbleActions.append(makeButton('⭐', 'Save to diary', 'save'), makeButton('👎', 'Fewer like this', 'less'))
    const tone = s.kind === 'remind' ? '#fff4d6' : s.kind === 'hint' ? '#ffe9ec' : s.kind === 'routine' ? '#e8f6ff' : '#ffffff'
    bubble.style.background = tone
    bubbleTail.style.background = tone
    bubble.style.border = `2px solid ${outline()}`
    bubbleTail.style.borderRight = bubbleTail.style.borderBottom = `2px solid ${outline()}`
    bubble.style.opacity = '1'
    bubble.style.pointerEvents = 'auto'
  }
  const offSpeech = pet.events.on('speech', showSpeech)
  showSpeech(pet.speech)
  bubble.addEventListener('pointerenter', () => pet.holdSpeech(60))
  bubble.addEventListener('pointerleave', () => pet.holdSpeech(1.5))
  bubble.addEventListener('click', () => pet.dismissSpeech())

  function placeBubble() {
    if (!pet.speech) return
    const m = svg.getScreenCTM()
    if (!m) return
    const top = pet.body.catToWorld(pet.body.frame.headTop)
    const pt = new win.DOMPoint(top.x, top.y - 4).matrixTransform(m)
    const box = container.getBoundingClientRect()
    const ax = pt.x - box.left
    const ay = pt.y - box.top
    const bw = bubble.offsetWidth
    const bh = bubble.offsetHeight
    const left = clamp(ax - bw / 2, 6, Math.max(6, box.width - bw - 6))
    const topPx = Math.max(4, ay - bh - 10)
    bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(topPx)}px)`
    bubbleTail.style.left = `${Math.round(clamp(ax - left - 6, 10, bw - 22))}px`
  }

  // ------------------------------------------------------------------ input

  const toWorld = (e: PointerEvent): Vec | null => {
    const m = svg.getScreenCTM()
    if (!m) return null
    const pt = new win.DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }

  let lastPt: Vec | null = null
  let down: { p: Vec; t: number; onCat: boolean } | null = null
  const onMove = (e: PointerEvent) => {
    const p = toWorld(e)
    if (!p) return
    pet.setPointer(p)
    if (pet.props.toyMode) {
      pet.setToy(p)
    } else if (lastPt && (e.target as Element).closest?.('[data-pet-hit]')) {
      const d = Math.hypot(p.x - lastPt.x, p.y - lastPt.y)
      if (d > 0.4) pet.stroke(Math.min(d, 25))
    }
    lastPt = p
  }
  const onLeave = () => {
    pet.setPointer(null)
    if (pet.props.toyMode) pet.setToy(null)
    lastPt = null
  }
  const onDown = (e: PointerEvent) => {
    const p = toWorld(e)
    if (p) down = { p, t: win.performance.now(), onCat: !!(e.target as Element).closest?.('[data-pet-hit]') }
  }
  const onUp = (e: PointerEvent) => {
    const p = toWorld(e)
    if (down && p && down.onCat && !pet.props.toyMode && Math.hypot(p.x - down.p.x, p.y - down.p.y) < 6 && win.performance.now() - down.t < 450) pet.boop()
    down = null
  }
  if (opts.interactive !== false) {
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerleave', onLeave)
    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointerup', onUp)
  }

  // ------------------------------------------------------------------ loop

  let cat = cats.build(pet.body.geometry)
  let raf = 0
  let lastFrame = 0
  let lastTs = 0
  const loop = (ts: number) => {
    raf = win.requestAnimationFrame(loop)
    const cap = pet.life.asleep ? sleepFps : fps
    if (ts - lastFrame < 1000 / cap - 2) return
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 1 / 60
    lastTs = ts
    lastFrame = ts
    pet.tick(Date.now())
    if (cat.geometry !== pet.body.geometry) cat = cats.build(pet.body.geometry)
    svg.style.cursor = pet.props.toyMode ? 'none' : ''
    updateCamera(dt)
    scene.render(view)
    cats.render(cat)
    renderDark(dt)
    renderToy(dt)
    particles.render()
    placeBubble()
  }
  raf = win.requestAnimationFrame(loop)

  return {
    svg,
    destroy() {
      win.cancelAnimationFrame(raf)
      offSpeech()
      svg.remove()
      bubble.remove()
    },
  }
}
