import type { CatGeometry } from '../anim/geometry'
import type { LegFrame } from '../anim/rig'
import { clamp, lerp, r2, shade } from '../core/math'
import { getAccessory } from '../custom/accessories'
import { resolvePattern } from '../custom/patterns'
import type { Pet } from '../pet'
import type { Dom } from './dom'

interface LegEls {
  outline: SVGPathElement
  fill: SVGPathElement
  sock: SVGPathElement | null
}

interface TailEls {
  outline: SVGPathElement
  fill: SVGPathElement
  tip: SVGPathElement | null
}

interface EyeEls {
  g: SVGGElement
  open: SVGGElement
  pupil: SVGGElement
  lid: SVGPathElement
  closed: SVGPathElement
  side: number
}

interface CatEls {
  geometry: CatGeometry
  root: SVGGElement
  shadow: SVGEllipseElement
  tailBack: TailEls
  tailFront: TailEls
  tailFrontG: SVGGElement
  legs: { fn: LegEls; ff: LegEls; bn: LegEls; bf: LegEls; fnFront: LegEls }
  fnBackG: SVGGElement
  fnFrontG: SVGGElement
  body: SVGGElement
  head: SVGGElement
  earL: SVGGElement
  earR: SVGGElement
  features: SVGGElement
  lidRect: SVGRectElement
  eyes: EyeEls[]
  mouthClosed: SVGPathElement
  mouthOpen: SVGGElement
  mouthOpenPath: SVGPathElement
  mouthTongue: SVGEllipseElement
  blep: SVGPathElement
  whiskers: SVGGElement[]
  blush: SVGEllipseElement[]
}

/** Builds the cat's SVG from its geometry and updates it from the rig every frame. */
export function createCatRenderer(dom: Dom, svg: SVGSVGElement, catLayer: SVGGElement, uid: string, pet: Pet) {
  const { el, set, drawShapes } = dom
  const defs = el('defs', {}, svg)

  function buildCat(g: CatGeometry): CatEls {
    defs.replaceChildren()
    const a = g.appearance
    const c = g.colors
    const ow = g.outline
    const pat = resolvePattern(g)
    const outlined = { stroke: c.outline, 'stroke-width': ow, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }

    const bodyClip = el('clipPath', { id: `${uid}-body` }, defs)
    el('path', { d: g.bodyPath }, bodyClip)
    const headClip = el('clipPath', { id: `${uid}-head` }, defs)
    el('path', { d: g.headPath }, headClip)
    const lidClip = el('clipPath', { id: `${uid}-lid` }, defs)
    const lidRect = el('rect', { x: -g.eye.rx - 3, y: -g.eye.ry - 2, width: g.eye.rx * 2 + 6, height: g.eye.ry * 2 + 6 }, lidClip)

    const root = el('g')
    const shadow = el('ellipse', { cx: 0, cy: 0, rx: 40, ry: 5.5, fill: '#2a1a2a', opacity: 0.16 }, root)

    const makeTail = (parent: Element): TailEls => {
      const tailG = el('g', { 'data-pet-hit': 'tail' }, parent)
      return {
        outline: el('path', { fill: 'none', stroke: c.outline, 'stroke-width': ow, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, tailG),
        fill: el('path', { fill: pat.tail ?? c.fur }, tailG),
        tip: pat.tailTip ? el('path', { fill: pat.tailTip }, tailG) : null,
      }
    }
    const makeLeg = (parent: Element, far: boolean): LegEls => {
      const color = far ? c.furShade : c.fur
      const sockColor = pat.paws ? (far ? shade(pat.paws, -0.12) : pat.paws) : null
      return {
        outline: el('path', { stroke: c.outline, 'stroke-width': g.legW + ow, 'stroke-linecap': 'round', fill: 'none' }, parent),
        fill: el('path', { stroke: color, 'stroke-width': g.legW, 'stroke-linecap': 'round', fill: 'none' }, parent),
        sock: sockColor ? el('path', { stroke: sockColor, 'stroke-width': g.legW, 'stroke-linecap': 'round', fill: 'none' }, parent) : null,
      }
    }

    const tailBack = makeTail(root)
    const legsBack = el('g', {}, root)
    const ff = makeLeg(legsBack, true)
    const bf = makeLeg(legsBack, true)
    const bn = makeLeg(legsBack, false)
    const fnBackG = el('g', {}, legsBack)
    const fn = makeLeg(fnBackG, false)

    // --- body
    const body = el('g', {}, root)
    el('path', { d: g.bodyPath, fill: c.fur, ...outlined, 'data-pet-hit': 'body' }, body)
    const bodyDeco = el('g', { 'clip-path': `url(#${uid}-body)`, 'pointer-events': 'none' }, body)
    if (pat.belly) el('path', { d: g.bellyPath, fill: c.belly }, bodyDeco)
    drawShapes(pat.body, bodyDeco)

    const tailFrontG = el('g', {}, root)
    const tailFront = makeTail(tailFrontG)

    // --- head
    const head = el('g', {}, root)
    const accessories = a.accessories.map((cfg) => ({ cfg, acc: getAccessory(cfg.id) })).filter((x) => x.acc)
    const drawAccessories = (layer: 'neck' | 'head' | 'face', parent: Element) => {
      for (const { cfg, acc } of accessories) {
        if (acc!.layer === layer) drawShapes(acc!.shapes({ g, color: cfg.color, color2: cfg.color2 ?? cfg.color, outline: c.outline }), parent)
      }
    }
    drawAccessories('neck', el('g', { 'pointer-events': 'none' }, head))

    const makeEar = (side: number) => {
      const earG = el('g', {}, head)
      const inner = el('g', { transform: `scale(${side} 1)` }, earG)
      el('path', { d: g.ear.path, fill: pat.ears ?? c.fur, ...outlined }, inner)
      el('path', { d: g.ear.innerPath, fill: pat.ears ? shade(pat.ears, 0.25) : c.innerEar }, inner)
      return earG
    }
    const earL = makeEar(-1)
    const earR = makeEar(1)

    el('path', { d: g.headPath, fill: c.fur, ...outlined, 'data-pet-hit': 'head' }, head)
    drawShapes(pat.head, el('g', { 'clip-path': `url(#${uid}-head)`, 'pointer-events': 'none' }, head))

    const features = el('g', { 'pointer-events': 'none' }, head)
    const hs = g.headScale
    const blush = [-1, 1].map((s) =>
      el('ellipse', { cx: s * (g.eye.spacing + 6 * hs), cy: g.eye.y + 9 * hs, rx: 5.5 * hs, ry: 3.2 * hs, fill: c.blush, opacity: 0 }, features),
    )

    const irises = Array.isArray(a.eyes.color) ? a.eyes.color : [a.eyes.color, a.eyes.color]
    const eyes = [-1, 1].map((side, i): EyeEls => {
      const eg = el('g', {}, features)
      const open = el('g', { 'clip-path': `url(#${uid}-lid)` }, eg)
      const { rx, ry } = g.eye
      el('ellipse', { rx, ry, fill: irises[i], stroke: c.outline, 'stroke-width': 1.3 }, open)
      const pupil = el('g', {}, open)
      el('ellipse', { rx: rx * 0.96, ry: ry * 0.96, fill: '#24171b' }, pupil)
      el('circle', { cx: -rx * 0.28, cy: -ry * 0.36, r: rx * 0.36, fill: '#fff' }, open)
      el('circle', { cx: rx * 0.34, cy: ry * 0.32, r: rx * 0.15, fill: '#fff' }, open)
      const lid = el('path', { stroke: c.outline, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' }, eg)
      const closed = el('path', { stroke: c.outline, 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none' }, eg)
      return { g: eg, open, pupil, lid, closed, side }
    })

    const nose = el('g', { transform: `translate(0 ${g.noseY}) scale(${hs})` }, features)
    el('path', { d: 'M-3.4 -1.6Q0 -2.8 3.4 -1.6Q2.2 1.9 0 2.2Q-2.2 1.9 -3.4 -1.6Z', fill: c.nose, stroke: c.outline, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, nose)

    const mouth = el('g', { transform: `translate(0 ${g.mouthY}) scale(${hs})` }, features)
    const blep = el('path', { fill: '#ff8fa3', stroke: c.outline, 'stroke-width': 1, opacity: 0 }, mouth)
    const mouthClosed = el('path', { d: 'M-6 0.2Q-3 4 0 0.6Q3 4 6 0.2', stroke: c.outline, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, mouth)
    const mouthOpen = el('g', { opacity: 0 }, mouth)
    const mouthOpenPath = el('path', { fill: '#7a2f3a', stroke: c.outline, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, mouthOpen)
    const mouthTongue = el('ellipse', { cx: 0, rx: 3, fill: '#ff8fa3' }, mouthOpen)

    const wl = a.face.whiskers
    const whiskers = [-1, 1].map((s) => {
      const wg = el('g', {}, features)
      if (wl > 0) {
        for (const dy of [-2.2, 0.4, 3]) {
          el('path', { d: `M${s * 2} ${dy}Q${s * 10 * wl} ${dy * 1.4 - 1} ${s * 19 * wl} ${dy * 2.4}`, stroke: c.outline, 'stroke-width': 1.1, 'stroke-linecap': 'round', fill: 'none', opacity: 0.55 }, wg)
        }
      }
      return wg
    })
    drawAccessories('face', features)
    drawAccessories('head', el('g', { 'pointer-events': 'none' }, head))

    // A raised paw (grooming, swatting, kneading) sits in front of everything.
    const fnFrontG = el('g', {}, root)
    const fnFront = makeLeg(fnFrontG, false)

    catLayer.replaceChildren(root)
    for (const hit of root.querySelectorAll('[data-pet-hit]')) (hit as SVGElement).style.cursor = 'grab'

    return {
      geometry: g,
      root,
      shadow,
      tailBack,
      tailFront,
      tailFrontG,
      legs: { fn, ff, bn, bf, fnFront },
      fnBackG,
      fnFrontG,
      body,
      head,
      earL,
      earR,
      features,
      lidRect,
      eyes,
      mouthClosed,
      mouthOpen,
      mouthOpenPath,
      mouthTongue,
      blep,
      whiskers,
      blush,
    }
  }

  const updateLeg = (els: LegEls, leg: LegFrame, legW: number) => {
    const d = `M${r2(leg.hip.x)} ${r2(leg.hip.y)}L${r2(leg.paw.x)} ${r2(leg.paw.y)}`
    set(els.outline, 'd', d)
    set(els.fill, 'd', d)
    if (els.sock) {
      const dx = leg.paw.x - leg.hip.x
      const dy = leg.paw.y - leg.hip.y
      const len = Math.hypot(dx, dy) || 1
      const k = Math.min(1, (legW * 0.55) / len)
      set(els.sock, 'd', `M${r2(leg.paw.x - dx * k)} ${r2(leg.paw.y - dy * k)}L${r2(leg.paw.x)} ${r2(leg.paw.y)}`)
    }
  }

  const updateTail = (els: TailEls, fill: string, outline: string, tip: string) => {
    set(els.fill, 'd', fill)
    set(els.outline, 'd', outline)
    if (els.tip) set(els.tip, 'd', tip)
  }

  function renderCat(cat: CatEls) {
    const b = pet.body
    const fr = b.frame
    const g = cat.geometry
    const s = b.size
    set(cat.root, 'transform', `translate(${r2(b.x)} ${r2(b.elevation)}) scale(${r2(b.facingVisual * s)} ${r2(s)})`)
    set(cat.shadow, 'cx', fr.shadow.x)
    set(cat.shadow, 'rx', fr.shadow.rx)
    set(cat.shadow, 'opacity', b.jumping ? 0 : fr.shadow.opacity)

    // Tail: back copy always; front copy only when wrapped around the paws.
    updateTail(cat.tailBack, fr.tail.fill, fr.tail.outline, fr.tail.tipFill)
    set(cat.tailFrontG, 'display', fr.tail.front ? 'inline' : 'none')
    if (fr.tail.front) updateTail(cat.tailFront, fr.tail.frontFill, fr.tail.frontOutline, fr.tail.tipFill)

    updateLeg(cat.legs.ff, fr.legs.ff, g.legW)
    updateLeg(cat.legs.bf, fr.legs.bf, g.legW)
    updateLeg(cat.legs.bn, fr.legs.bn, g.legW)
    set(cat.fnBackG, 'display', fr.pawUp ? 'none' : 'inline')
    set(cat.fnFrontG, 'display', fr.pawUp ? 'inline' : 'none')
    updateLeg(fr.pawUp ? cat.legs.fnFront : cat.legs.fn, fr.legs.fn, g.legW)

    const bd = fr.body
    set(cat.body, 'transform', `translate(${r2(bd.x)} ${r2(bd.y)}) rotate(${r2(bd.rot)}) scale(${r2(bd.sx)} ${r2(bd.sy)})`)
    set(cat.head, 'transform', `translate(${r2(fr.head.x)} ${r2(fr.head.y)}) rotate(${r2(fr.head.rot)})`)

    const e = fr.ears
    const eb = g.ear.base
    set(cat.earL, 'transform', `translate(${r2(-eb.x + e.shiftX)} ${r2(eb.y)}) rotate(${r2(e.lRot)}) scale(1 ${r2(e.sy)})`)
    set(cat.earR, 'transform', `translate(${r2(eb.x + e.shiftX)} ${r2(eb.y)}) rotate(${r2(e.rRot)}) scale(1 ${r2(e.sy)})`)

    const f = fr.face
    const hs = g.headScale
    set(cat.features, 'transform', `translate(${r2(f.lookX * 3.5 * hs)} ${r2(f.lookY * 2.5 * hs)})`)

    // Eyes: a lid clip slides down; fully shut eyes become a curved line.
    const { rx, ry } = g.eye
    const open = f.eyeOpen
    const lidY = -ry - 1 + (1 - open) * (ry * 2 + 2)
    set(cat.lidRect, 'y', lidY)
    const showOpen = open > 0.1
    const lidHalf = rx * Math.sqrt(clamp(1 - (lidY / ry) ** 2))
    const happy = f.eyeHappy
    const cy = lerp(4.5, -6.5, happy) * hs
    const ey = lerp(-0.5, 2, happy) * hs
    const closedD = `M${r2(-rx)} ${r2(ey)}Q0 ${r2(cy)} ${r2(rx)} ${r2(ey)}`
    for (const eye of cat.eyes) {
      set(eye.g, 'transform', `translate(${r2(eye.side * g.eye.spacing)} ${r2(g.eye.y)})`)
      set(eye.open, 'display', showOpen ? 'inline' : 'none')
      set(eye.pupil, 'transform', `translate(${r2(f.lookX * rx * 0.2)} ${r2(f.lookY * ry * 0.16)}) scale(${r2(f.pupil)})`)
      const lidVisible = showOpen && open < 0.88
      set(eye.lid, 'display', lidVisible ? 'inline' : 'none')
      if (lidVisible) set(eye.lid, 'd', `M${r2(-lidHalf - 0.5)} ${r2(lidY)}L${r2(lidHalf + 0.5)} ${r2(lidY)}`)
      set(eye.closed, 'display', showOpen ? 'none' : 'inline')
      if (!showOpen) set(eye.closed, 'd', closedD)
    }

    // Mouth: closed "ω", open (meow/yawn), or a tiny tongue blep.
    const mo = f.mouthOpen
    const mouthIsOpen = mo > 0.06
    set(cat.mouthClosed, 'opacity', mouthIsOpen ? 0 : 1)
    set(cat.mouthOpen, 'opacity', mouthIsOpen ? 1 : 0)
    if (mouthIsOpen) {
      const h = 2 + mo * 9
      set(cat.mouthOpenPath, 'd', `M-4.6 0.4Q0 -1.2 4.6 0.4Q4.6 ${r2(h)} 0 ${r2(h)}Q-4.6 ${r2(h)} -4.6 0.4Z`)
      set(cat.mouthTongue, 'cy', h * 0.72)
      set(cat.mouthTongue, 'ry', h * 0.28)
    }
    const blep = !mouthIsOpen && f.tongue > 0.05
    set(cat.blep, 'opacity', blep ? 1 : 0)
    if (blep) {
      const L = 1.2 + f.tongue * 3.6
      set(cat.blep, 'd', `M-2.6 1.2Q-2.6 ${r2(1.2 + L)} 0 ${r2(1.2 + L)}Q2.6 ${r2(1.2 + L)} 2.6 1.2Z`)
    }

    cat.whiskers.forEach((w, i) => {
      const side = i === 0 ? -1 : 1
      set(w, 'transform', `translate(${r2(side * 10 * hs)} ${r2(g.noseY + 1.5 * hs)}) rotate(${r2(-f.whisker * side)})`)
    })
    for (const bl of cat.blush) set(bl, 'opacity', clamp(f.blush) * 0.55)
  }

  return { build: buildCat, render: renderCat }
}
