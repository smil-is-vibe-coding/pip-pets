import { clamp, createRng, r2 } from '../core/math'
import type { Pet } from '../pet'
import type { SceneDef } from '../world/types'
import type { Dom } from './dom'

const INK = '#5a4038'
const FOOD_COLORS = { kibble: '#b5763a', fish: '#f39b6d', treat: '#e94e77' }
const BIRD_COLORS = ['#7ec8ff', '#ff9f6e', '#ffd34e']

export interface SceneLayers {
  wall: SVGGElement
  windows: SVGGElement
  back: SVGGElement
  props: SVGGElement
  covers: SVGGElement
  front: SVGGElement
  critters: SVGGElement
  tint: SVGRectElement
  glow: SVGGElement
}

/** Draws the room: backdrop, sky, furniture, props, critters and lighting. */
export function createSceneRenderer(dom: Dom, svg: SVGSVGElement, layers: SceneLayers, uid: string, pet: Pet) {
  const { el, set, drawShapes } = dom
  const defs = el('defs', {}, svg)

  let def: SceneDef | null = null
  let skyStops: SVGStopElement[] = []
  let stars: SVGGElement[] = []
  let sunEls: Element[] = []
  let glowEls: Element[] = []
  let covers = new Map<string, SVGGElement>()
  let bowl: { g: SVGGElement; food: SVGEllipseElement } | null = null
  let water: SVGEllipseElement | null = null
  let yarn: SVGGElement | null = null
  let birdsG: SVGGElement | null = null
  const birdEls = new Map<number, SVGGElement>()
  const flyEls = new Map<number, { g: SVGGElement; wings: SVGGElement }>()
  let lastFoodKind = ''

  function build(d: SceneDef) {
    def = d
    for (const layer of [layers.wall, layers.windows, layers.back, layers.props, layers.covers, layers.front, layers.critters, layers.glow]) layer.replaceChildren()
    defs.replaceChildren()
    birdEls.clear()
    flyEls.clear()
    covers = new Map()

    // Sky gradient shared by every window.
    const grad = el('linearGradient', { id: `${uid}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs)
    skyStops = [el('stop', { offset: 0 }, grad), el('stop', { offset: 1 }, grad)]
    const clip = el('clipPath', { id: `${uid}-win` }, defs)
    const glowGrad = el('radialGradient', { id: `${uid}-glow` }, defs)
    el('stop', { offset: 0, 'stop-color': '#ffd38a', 'stop-opacity': 0.9 }, glowGrad)
    el('stop', { offset: 1, 'stop-color': '#ffd38a', 'stop-opacity': 0 }, glowGrad)

    drawShapes(d.art.wall, layers.wall)
    const rng = createRng(7)
    stars = []
    for (const w of d.art.windows) {
      el('rect', { x: w.x, y: w.y, width: w.w, height: w.h, fill: `url(#${uid}-sky)` }, layers.windows)
      el('rect', { x: w.x, y: w.y, width: w.w, height: w.h }, clip)
      const sg = el('g', { opacity: 0 }, layers.windows)
      const count = Math.min(40, Math.round((w.w * Math.min(w.h, 300)) / 1500))
      for (let i = 0; i < count; i++) {
        el('circle', { cx: w.x + rng() * w.w, cy: w.y + Math.max(0, w.h - 300) + rng() * Math.min(w.h, 300) * 0.8, r: 0.8 + rng() * 1.2, fill: '#fff8d6' }, sg)
      }
      stars.push(sg)
    }
    birdsG = el('g', { 'clip-path': `url(#${uid}-win)` }, layers.windows)

    sunEls = []
    glowEls = []
    for (const s of d.art.back) {
      const [node] = drawShapes([s.tag === 'glow' ? { ...s, fill: `url(#${uid}-glow)` } : s], s.tag === 'glow' ? layers.glow : layers.back)
      if (s.tag === 'sun') sunEls.push(node)
      if (s.tag === 'glow') glowEls.push(node)
    }

    // Props live at their spots.
    const bowlSpot = d.spots.find((s) => s.kind === 'bowl')
    const waterSpot = d.spots.find((s) => s.kind === 'water')
    const toys = d.spots.find((s) => s.kind === 'toys')
    bowl = null
    water = null
    yarn = null
    lastFoodKind = ''
    if (bowlSpot) {
      const g = el('g', { transform: `translate(${bowlSpot.x} 0)` }, layers.props)
      const food = el('ellipse', { cx: 0, cy: -11, rx: 12, ry: 5, stroke: INK, 'stroke-width': 1.5 }, g)
      el('path', { d: 'M-17 -11L17 -11Q15 0 9 1L-9 1Q-15 0 -17 -11Z', fill: '#ffb38a', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g)
      el('path', { d: 'M-8 -6Q-4 -2 0 -6Q4 -2 8 -6', stroke: '#ffffff', 'stroke-width': 1.6, fill: 'none', opacity: 0.8 }, g)
      bowl = { g, food }
    }
    if (waterSpot && d.id !== 'empty') {
      const g = el('g', { transform: `translate(${waterSpot.x} 0)` }, layers.props)
      water = el('ellipse', { cx: 0, cy: -10, rx: 13, ry: 3.2, fill: '#8fd3ff' }, g)
      el('path', { d: 'M-17 -11L17 -11Q15 0 9 1L-9 1Q-15 0 -17 -11Z', fill: '#7fb7e6', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, g)
      el('path', { d: 'M-12 -6Q0 -4 12 -6', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none', opacity: 0.6 }, g)
    }
    if (toys) {
      yarn = el('g', {}, layers.props)
      el('circle', { r: 7.5, fill: '#b58cff', stroke: INK, 'stroke-width': 1.8 }, yarn)
      el('path', { d: 'M-6 -2Q0 2 6 -3M-5.5 2.5Q0 5 6 1.5M-2 -7Q2 0 -1 7', stroke: '#6f4bd8', 'stroke-width': 1.2, fill: 'none' }, yarn)
    }

    for (const s of d.spots) {
      if (!s.cover) continue
      const g = el('g', { display: 'none', 'pointer-events': 'none' }, layers.covers)
      drawShapes(s.cover, g)
      covers.set(s.id, g)
    }
    drawShapes(d.art.front, layers.front)
  }

  const buildBird = (id: number): SVGGElement => {
    const g = el('g', {}, birdsG!)
    const inner = el('g', {}, g)
    const color = BIRD_COLORS[id % BIRD_COLORS.length]
    el('path', { d: 'M-7 -2L-12 -5L-11 1Z', fill: color, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, inner)
    el('ellipse', { cx: 0, cy: 0, rx: 7.5, ry: 6, fill: color, stroke: INK, 'stroke-width': 1.5 }, inner)
    el('circle', { cx: 5, cy: -5, r: 4.2, fill: color, stroke: INK, 'stroke-width': 1.5 }, inner)
    el('path', { d: 'M8.5 -5.5L12 -4.5L8.5 -3.5Z', fill: '#ffb84d', stroke: INK, 'stroke-width': 1, 'stroke-linejoin': 'round' }, inner)
    el('circle', { cx: 6, cy: -6, r: 0.9, fill: INK }, inner)
    el('path', { d: 'M-4 -1Q0 4 4 0', stroke: INK, 'stroke-width': 1.2, fill: 'none' }, inner)
    el('path', { d: 'M-1 6V9M2 6V9', stroke: INK, 'stroke-width': 1.2 }, inner)
    return g
  }

  const buildFly = (color: string) => {
    const g = el('g', {}, layers.critters)
    const wings = el('g', {}, g)
    el('ellipse', { cx: -4.5, cy: -2, rx: 5, ry: 6.5, fill: color, stroke: INK, 'stroke-width': 1.2 }, wings)
    el('ellipse', { cx: 4.5, cy: -2, rx: 5, ry: 6.5, fill: color, stroke: INK, 'stroke-width': 1.2 }, wings)
    el('ellipse', { cx: -3.5, cy: 4, rx: 3, ry: 3.5, fill: color, stroke: INK, 'stroke-width': 1.1 }, wings)
    el('ellipse', { cx: 3.5, cy: 4, rx: 3, ry: 3.5, fill: color, stroke: INK, 'stroke-width': 1.1 }, wings)
    el('path', { d: 'M0 -6V7M0 -6L-2 -10M0 -6L2 -10', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round', fill: 'none' }, g)
    return { g, wings }
  }

  /** `view` is the visible world rect (for the full-screen tint). */
  function render(view: { x: number; y: number; w: number; h: number }) {
    const w = pet.world
    if (w.def !== def) build(w.def)
    const sky = w.sky()
    set(skyStops[0], 'stop-color', sky.top)
    set(skyStops[1], 'stop-color', sky.bottom)
    for (const s of stars) set(s, 'opacity', clamp(sky.night * 1.2 - 0.2))
    for (const s of sunEls) set(s, 'opacity', sky.sun * 0.55)
    const lit = pet.props.lightsOff ? 0 : 1
    for (const g of glowEls) set(g, 'opacity', clamp(sky.night * 0.75 * lit))
    set(layers.tint, 'x', view.x - 5)
    set(layers.tint, 'y', view.y - 5)
    set(layers.tint, 'width', view.w + 10)
    set(layers.tint, 'height', view.h + 10)
    set(layers.tint, 'fill', sky.tint)
    set(layers.tint, 'opacity', sky.tintOpacity)

    if (bowl) {
      const amt = clamp(w.bowl.food / 8)
      if (w.bowl.kind !== lastFoodKind) {
        lastFoodKind = w.bowl.kind
        set(bowl.food, 'fill', FOOD_COLORS[w.bowl.kind])
      }
      set(bowl.food, 'ry', 1 + amt * 5)
      set(bowl.food, 'cy', -10 - amt * 2)
      set(bowl.food, 'opacity', w.bowl.food > 0.05 ? 1 : 0)
      set(bowl.g, 'display', def?.id === 'empty' && w.bowl.food <= 0.05 && pet.action !== 'eat' ? 'none' : 'inline')
    }
    if (water) {
      set(water, 'opacity', w.water > 0.03 ? 0.4 + w.water * 0.6 : 0)
      set(water, 'ry', 1.5 + w.water * 2.2)
    }
    if (yarn) set(yarn, 'transform', `translate(${r2(w.yarn.x)} -7.5) rotate(${r2((w.yarn.spin / 7.5) * 57.3)})`)

    const settled = !pet.body.moving
    for (const [id, g] of covers) set(g, 'display', id === pet.atSpot && settled ? 'inline' : 'none')

    // Birds
    const alive = new Set<number>()
    for (const b of w.birds) {
      alive.add(b.id)
      let g = birdEls.get(b.id)
      if (!g) birdEls.set(b.id, (g = buildBird(b.id)))
      const hop = b.leaving ? 0 : Math.max(0, Math.sin(b.age * 5)) * (Math.sin(b.age * 0.7) > 0.6 ? 2.5 : 0)
      set(g, 'transform', `translate(${r2(b.x)} ${r2(b.y - hop)}) scale(${b.facing} 1)`)
    }
    for (const [id, g] of birdEls) {
      if (alive.has(id)) continue
      g.remove()
      birdEls.delete(id)
    }

    // Butterflies
    const flying = new Set<number>()
    for (const f of w.butterflies) {
      flying.add(f.id)
      let e = flyEls.get(f.id)
      if (!e) flyEls.set(f.id, (e = buildFly(f.color)))
      set(e.g, 'transform', `translate(${r2(f.x)} ${r2(f.y)}) rotate(${f.dir * 8})`)
      set(e.wings, 'transform', `scale(${r2(0.25 + Math.abs(Math.cos(f.phase)) * 0.75)} 1)`)
    }
    for (const [id, e] of flyEls) {
      if (flying.has(id)) continue
      e.g.remove()
      flyEls.delete(id)
    }
  }

  return { render }
}
